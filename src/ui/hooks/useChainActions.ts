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
  chopTree,
  craftItem,
  fishTile,
  mineTile,
  mintHouse,
  placeBuildTile,
  triggerWorldEvent,
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
  // One transaction now. This used to be four: read state, ask the oracle,
  // apply the inventory delta, maybe apply a house event, then update the
  // profile — with the oracle's rewards discarded in the middle because the
  // registry could not trust them. The contract does the whole thing.
  const doSubmitEvent = useCallback(async () => {
    const store = useGameStore.getState()
    if (!store.walletAddress) { toast.error('Connect your wallet to trigger a world event.'); return }

    store.setTxStatus(true, 'Reading the news and consulting the world AI (~30s)...')
    try {
      const client     = createWriteClient(store.walletAddress)
      const resultJson = await triggerWorldEvent(client)
      const result     = JSON.parse(resultJson)

      // Everything here is what the contract actually applied, not a proposal.
      const delta = {
        eventType:         result.event_type,
        eventName:         result.event_name,
        description:       result.description,
        healthDelta:       result.health_delta ?? 0,
        energyDelta:       result.energy_delta ?? 0,
        xpDelta:           result.xp_delta ?? 0,
        inventoryDelta:    result.inventory_delta ?? {},
        houseDamaged:      Boolean(result.house_damaged),
        houseDamageAmount: 0,
        houseQualityDelta: result.house_quality_delta ?? 0,
        reasoning:         result.reasoning ?? '',
      }

      window.dispatchEvent(new CustomEvent('gensurvival:aiEvent', { detail: delta }))

      const s = useGameStore.getState()
      s.setLastAIEvent(delta)
      if (result.house_damaged && typeof result.damaged_house_id === 'number') {
        s.setHouses(s.houses.map(h =>
          h.tokenId === result.damaged_house_id ? { ...h, damaged: true } : h))
      }
      s.setTxStatus(false, '')
      toast.info(`${result.event_type === 'good' ? 'Fortune' : 'Event'}: ${result.event_name}`)

      logAIEvent(store.walletAddress, result.epoch ?? 0, result.event_type, result).catch(() => {})
      upsertPlayer({
        address:       store.walletAddress,
        name:          s.playerName,
        score:         result.score ?? 0,
        house_count:   s.houses.length,
        days_survived: s.playerStats?.dayNumber ?? 0,
        xp:            result.xp ?? 0,
      }).catch(() => { /* best-effort */ })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      useGameStore.getState().setTxStatus(false, '')
      toast.error(`World event failed: ${msg}`)
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
      // No local grant on failure: the chain owns the inventory, and handing
      // out a fish here desynced it from what crafting can actually spend.
      toast.error(`Fishing failed: ${msg}`)
      return null
    }
  }, [])

  // Stable object — only created once because all callbacks have [] deps
  return useMemo(
    () => ({ doCraft, doMineTile, doChopTree, doPlaceBuildTile, doMintHouse, doSubmitEvent, doFishTile }),
    [doCraft, doMineTile, doChopTree, doPlaceBuildTile, doMintHouse, doSubmitEvent, doFishTile],
  )
}
