/**
 * useChainActions — wraps every on-chain game action.
 *
 * IMPORTANT: this hook must NOT call useGameStore() without a selector.
 * Phaser calls setPlayerStats() every frame, which updates the store on
 * every frame. A full-store subscription here would force App to re-render
 * every frame, creating a new `chain` object every frame, which triggers
 * useEffect([chain]) constantly — pushing React past the 25-render limit
 * and throwing error #185 (Maximum update depth exceeded).
 *
 * Fix: all action functions use useGameStore.getState() internally at
 * call-time, and are wrapped in useCallback(fn, []) so they are stable
 * references. The returned object is memoised so `chain` never changes.
 */
import { useCallback, useMemo } from 'react'
import { useGameStore } from '../store'
import { createWriteClient } from '../../chain/client'
import {
  applyHouseEvent,
  applyInventoryDeltaOnChain,
  chopTree,
  craftItem,
  fishTile,
  getPlayerState,
  mineTile,
  mintHouse,
  placeBuildTile,
  submitPlayerStats,
  updateProfile,
  type ActionDelta,
} from '../../chain/contracts'
import type { StationType } from '../../game/registry/RECIPES'
import { toast } from '../toast'
import { upsertPlayer, upsertHouse, logCraft, logAIEvent } from '../../storage/supabase'

export function inventoryDeltaFromAction(delta: ActionDelta): Record<string, number> {
  return {
    ...Object.fromEntries(Object.entries(delta.deduct).map(([id, amount]) => [id, -amount])),
    ...delta.grant,
  }
}

export function useChainActions() {
  // ── doCraft ──────────────────────────────────────────────────────────────
  const doCraft = useCallback(async (recipeId: string, quantity: number, station: StationType) => {
    const store = useGameStore.getState()
    if (!store.walletAddress) { toast.error('Connect your wallet first to forge on-chain.'); return }

    if (recipeId === 'house_deed') {
      if (!store.playerStats) return
      window.dispatchEvent(new CustomEvent('gensurvival:requestHouseMint', {
        detail: store.playerStats.inventory,
      }))
      store.closeCrafting()
      return
    }

    store.setTxStatus(true, 'Validating recipe on-chain...')
    try {
      const { walletAddress, craftingStationX: sx, craftingStationY: sy } = store
      const client = createWriteClient(walletAddress)
      const delta  = await craftItem(client, recipeId, station, quantity, sx, sy)

      window.dispatchEvent(new CustomEvent('gensurvival:craftDelta', { detail: delta }))
      useGameStore.getState().closeCrafting()
      useGameStore.getState().setTxStatus(false, '')

      const items = Object.entries(delta.grant)
        .map(([id, n]) => `${n}x ${id.replace(/_/g, ' ')}`)
        .join(', ')
      toast.success(`Forged: ${items}`)

      logCraft(walletAddress, recipeId, quantity, delta.deduct, delta.grant)
        .catch(() => { /* best-effort */ })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      useGameStore.getState().setTxStatus(false, '')
      toast.error(`Forge failed: ${msg}`)
    }
  }, [])

  // ── doMineTile ───────────────────────────────────────────────────────────
  const doMineTile = useCallback(async (x: number, y: number, terrainType: string) => {
    const store = useGameStore.getState()
    if (!store.walletAddress) { toast.error('Connect your wallet to mine on-chain.'); return }

    store.setTxStatus(true, 'Mining tile on-chain...')
    try {
      const client = createWriteClient(store.walletAddress)
      const delta  = await mineTile(client, x, y, terrainType)
      window.dispatchEvent(new CustomEvent('gensurvival:craftDelta', { detail: delta }))
      window.dispatchEvent(new CustomEvent('gensurvival:chainMineConfirmed', { detail: { x, y, delta } }))
      useGameStore.getState().setTxStatus(false, '')
      return delta
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      useGameStore.getState().setTxStatus(false, '')
      toast.error(`Mining failed: ${msg}`)
      window.dispatchEvent(new CustomEvent('gensurvival:chainMineRejected', { detail: { x, y } }))
      return null
    }
  }, [])

  // ── doChopTree ───────────────────────────────────────────────────────────
  const doChopTree = useCallback(async (x: number, y: number) => {
    const store = useGameStore.getState()
    if (!store.walletAddress) { toast.error('Connect your wallet to chop trees on-chain.'); return }

    store.setTxStatus(true, 'Recording chopped tree on-chain...')
    try {
      const client = createWriteClient(store.walletAddress)
      const delta  = await chopTree(client, x, y)
      window.dispatchEvent(new CustomEvent('gensurvival:craftDelta', { detail: delta }))
      useGameStore.getState().setTxStatus(false, '')
      return delta
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      useGameStore.getState().setTxStatus(false, '')
      toast.error(`Tree chop failed: ${msg}`)
      return null
    }
  }, [])

  // ── doPlaceBuildTile ─────────────────────────────────────────────────────
  const doPlaceBuildTile = useCallback(async (x: number, y: number, itemId: string) => {
    const store = useGameStore.getState()
    if (!store.walletAddress) { toast.error('Connect your wallet to build on-chain.'); return }

    store.setTxStatus(true, 'Placing build tile on-chain...')
    try {
      const client = createWriteClient(store.walletAddress)
      const delta  = await placeBuildTile(client, x, y, itemId)
      window.dispatchEvent(new CustomEvent('gensurvival:craftDelta', { detail: delta }))
      window.dispatchEvent(new CustomEvent('gensurvival:chainPlaceConfirmed', { detail: { x, y, itemId, delta } }))
      useGameStore.getState().setTxStatus(false, '')
      return delta
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      useGameStore.getState().setTxStatus(false, '')
      toast.error(`Build failed: ${msg}`)
      return null
    }
  }, [])

  // ── doMintHouse ──────────────────────────────────────────────────────────
  const doMintHouse = useCallback(async (prompt: {
    tileX: number; tileY: number; widthTiles: number; heightTiles: number
  }) => {
    const store = useGameStore.getState()
    if (!store.walletAddress) { toast.error('Connect your wallet to mint a house.'); return }

    store.setTxStatus(true, 'Minting verified house on-chain...')
    try {
      const client  = createWriteClient(store.walletAddress)
      const tokenId = await mintHouse(client, prompt.tileX, prompt.tileY, prompt.widthTiles, prompt.heightTiles, 'My House')

      const newHouse = {
        tokenId,
        tileX:      prompt.tileX,
        tileY:      prompt.tileY,
        widthTiles: prompt.widthTiles,
        heightTiles: prompt.heightTiles,
        quality:    1,
        damaged:    false,
        name:       'My House',
      }
      const s = useGameStore.getState()
      s.setHouses([...s.houses, newHouse])
      s.dismissHouseMint()
      s.setTxStatus(false, '')
      toast.success(`House minted! Token #${tokenId}`)

      upsertHouse(tokenId, store.walletAddress, {
        x: prompt.tileX, y: prompt.tileY,
        widthTiles: prompt.widthTiles, heightTiles: prompt.heightTiles,
        name: 'My House', quality: 1,
      }, false, 1).catch(() => { /* best-effort */ })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      useGameStore.getState().setTxStatus(false, '')
      toast.error(`House mint failed: ${msg}`)
    }
  }, [])

  // ── doSubmitEvent ────────────────────────────────────────────────────────
  const doSubmitEvent = useCallback(async () => {
    const store = useGameStore.getState()
    if (!store.walletAddress) { toast.error('Connect your wallet to submit stats to the AI oracle.'); return }
    if (!store.playerStats) return

    store.setTxStatus(true, 'Reading canonical state...')
    try {
      const client    = createWriteClient(store.walletAddress)
      const canonical = await getPlayerState(store.walletAddress)
      const stats     = useGameStore.getState().playerStats!
      const chainInventory = canonical?.inventory ?? {}

      const statsPayload = {
        health:             stats.health,
        max_health:         stats.maxHealth,
        energy:             stats.energy,
        max_energy:         stats.maxEnergy,
        xp:                 canonical?.xp ?? stats.xp,
        inventory:          chainInventory,
        house_token_ids:    useGameStore.getState().houses.map(h => h.tokenId),
        days_survived:      canonical?.days_survived ?? stats.dayNumber,
        zombies_killed:     0,
        resources_gathered: Object.values(chainInventory).reduce((a, b) => a + b, 0),
      }

      useGameStore.getState().setTxStatus(true, 'Waiting for AI consensus (~30s)...')
      const resultJson = await submitPlayerStats(client, JSON.stringify(statsPayload))
      const result     = JSON.parse(resultJson)

      const delta = {
        eventType:        result.event_type,
        eventName:        result.event_name,
        description:      result.description,
        healthDelta:      result.health_delta,
        energyDelta:      result.energy_delta,
        xpDelta:          result.xp_delta,
        inventoryDelta:   result.inventory_delta ?? {},
        houseDamaged:     result.house_damaged,
        houseDamageAmount: result.house_damage_amount,
        houseQualityDelta: result.house_quality_delta,
        reasoning:        result.reasoning,
      }

      // Snapshot oracle delta BEFORE apply_inventory_delta (which only persists losses)
      const oracleInventoryDelta = { ...delta.inventoryDelta }

      useGameStore.getState().setTxStatus(true, 'Applying AI effect on-chain...')
      await applyInventoryDeltaOnChain(
        client,
        `${useGameStore.getState().epochInfo?.currentEpoch ?? 0}-${result.event_name}`,
        delta.inventoryDelta,
        delta.xpDelta,
      )

      // Restore oracle delta so local game state reflects full event (gains + losses)
      delta.inventoryDelta = oracleInventoryDelta

      const currentStore = useGameStore.getState()
      if (delta.houseDamaged && currentStore.houses.length > 0) {
        await applyHouseEvent(
          client,
          currentStore.houses[0].tokenId,
          true,
          delta.houseQualityDelta,
          `${currentStore.epochInfo?.currentEpoch ?? 0}-${result.event_name}`,
        )
      }

      await updateProfile(client, JSON.stringify({
        name:        useGameStore.getState().playerName,
        house_count: useGameStore.getState().houses.length,
      }))

      window.dispatchEvent(new CustomEvent('gensurvival:aiEvent', { detail: delta }))
      const finalStore = useGameStore.getState()
      finalStore.setLastAIEvent(delta)
      finalStore.setTxStatus(false, '')
      toast.info(`AI Event: ${result.event_name}`)

      const latest = await getPlayerState(store.walletAddress)
      const epoch  = useGameStore.getState().epochInfo?.currentEpoch ?? 0
      Promise.all([
        upsertPlayer({
          address:      store.walletAddress,
          name:         useGameStore.getState().playerName,
          score:        latest?.score ?? 0,
          house_count:  latest?.house_count ?? useGameStore.getState().houses.length,
          days_survived: latest?.days_survived ?? stats.dayNumber,
          xp:           latest?.xp ?? stats.xp,
        }),
        logAIEvent(store.walletAddress, epoch, result.event_type, result),
      ]).catch(() => { /* best-effort */ })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      useGameStore.getState().setTxStatus(false, '')
      toast.error(`Submission failed: ${msg}`)
    }
  }, [])

  // ── doFishTile ───────────────────────────────────────────────────────────
  const doFishTile = useCallback(async (x: number, y: number) => {
    const store = useGameStore.getState()
    if (!store.walletAddress) { toast.error('Connect your wallet to fish on-chain.'); return }

    store.setTxStatus(true, 'Fishing on-chain… 🎣')
    try {
      const client = createWriteClient(store.walletAddress)
      const delta  = await fishTile(client, x, y)
      const granted = Object.entries(delta.grant)
      const itemId  = granted[0]?.[0] ?? 'FISH'
      const count   = granted[0]?.[1] ?? 1
      window.dispatchEvent(new CustomEvent('gensurvival:fishResult', { detail: { itemId, count } }))
      useGameStore.getState().setTxStatus(false, '')
      return delta
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      useGameStore.getState().setTxStatus(false, '')
      window.dispatchEvent(new CustomEvent('gensurvival:fishResult', { detail: { itemId: 'FISH', count: 1 } }))
      toast.error(`Fishing tx failed (${msg}) — local fish granted`)
      return null
    }
  }, [])

  // Stable object — only created once because all callbacks have [] deps
  return useMemo(
    () => ({ doCraft, doMineTile, doChopTree, doPlaceBuildTile, doMintHouse, doSubmitEvent, doFishTile }),
    [doCraft, doMineTile, doChopTree, doPlaceBuildTile, doMintHouse, doSubmitEvent, doFishTile],
  )
}
