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
import type { HouseMintPrompt } from '../store'
import { toast } from '../toast'
import { upsertPlayer, upsertHouse, logCraft, logAIEvent } from '../../storage/supabase'

export function inventoryDeltaFromAction(delta: ActionDelta): Record<string, number> {
  return {
    ...Object.fromEntries(Object.entries(delta.deduct).map(([id, amount]) => [id, -amount])),
    ...delta.grant,
  }
}

export function useChainActions() {
  const store = useGameStore()

  async function withWallet<T>(message: string, action: () => Promise<T>): Promise<T | null> {
    if (!store.walletAddress) {
      toast.error(message)
      return null
    }
    return action()
  }

  async function doCraft(recipeId: string, quantity: number, station: StationType) {
    if (recipeId === 'house_deed') {
      if (!store.playerStats) return
      window.dispatchEvent(new CustomEvent('gensurvival:requestHouseMint', {
        detail: store.playerStats.inventory,
      }))
      store.closeCrafting()
      return
    }

    await withWallet('Connect your wallet first to forge on-chain.', async () => {
      store.setTxStatus(true, 'Validating recipe on-chain...')
      try {
        const client = createWriteClient(store.walletAddress)
        // Pass the physical station tile coordinates so the contract can verify the
        // station is actually placed at that location.  HAND recipes use (0,0).
        const sx = store.craftingStationX
        const sy = store.craftingStationY
        const delta = await craftItem(client, recipeId, station, quantity, sx, sy)

        window.dispatchEvent(new CustomEvent('gensurvival:craftDelta', { detail: delta }))
        store.closeCrafting()
        store.setTxStatus(false, '')

        const items = Object.entries(delta.grant)
          .map(([id, n]) => `${n}x ${id.replace(/_/g, ' ')}`)
          .join(', ')
        toast.success(`Forged: ${items}`)

        logCraft(store.walletAddress, recipeId, quantity, delta.deduct, delta.grant)
          .catch(() => { /* best-effort */ })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        store.setTxStatus(false, '')
        toast.error(`Forge failed: ${msg}`)
      }
    })
  }

  async function doMineTile(x: number, y: number, terrainType: string) {
    return withWallet('Connect your wallet to mine on-chain.', async () => {
      store.setTxStatus(true, 'Mining tile on-chain...')
      try {
        const client = createWriteClient(store.walletAddress)
        const delta = await mineTile(client, x, y, terrainType)
        window.dispatchEvent(new CustomEvent('gensurvival:craftDelta', { detail: delta }))
        window.dispatchEvent(new CustomEvent('gensurvival:chainMineConfirmed', { detail: { x, y, delta } }))
        store.setTxStatus(false, '')
        return delta
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        store.setTxStatus(false, '')
        toast.error(`Mining failed: ${msg}`)
        window.dispatchEvent(new CustomEvent('gensurvival:chainMineRejected', { detail: { x, y } }))
        return null
      }
    })
  }

  async function doChopTree(x: number, y: number) {
    return withWallet('Connect your wallet to chop trees on-chain.', async () => {
      store.setTxStatus(true, 'Recording chopped tree on-chain...')
      try {
        const client = createWriteClient(store.walletAddress)
        const delta = await chopTree(client, x, y)
        window.dispatchEvent(new CustomEvent('gensurvival:craftDelta', { detail: delta }))
        store.setTxStatus(false, '')
        return delta
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        store.setTxStatus(false, '')
        toast.error(`Tree chop failed: ${msg}`)
        return null
      }
    })
  }

  async function doPlaceBuildTile(x: number, y: number, itemId: string) {
    return withWallet('Connect your wallet to build on-chain.', async () => {
      store.setTxStatus(true, 'Placing build tile on-chain...')
      try {
        const client = createWriteClient(store.walletAddress)
        const delta = await placeBuildTile(client, x, y, itemId)
        window.dispatchEvent(new CustomEvent('gensurvival:craftDelta', { detail: delta }))
        window.dispatchEvent(new CustomEvent('gensurvival:chainPlaceConfirmed', { detail: { x, y, itemId, delta } }))
        store.setTxStatus(false, '')
        return delta
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        store.setTxStatus(false, '')
        toast.error(`Build failed: ${msg}`)
        return null
      }
    })
  }

  async function doMintHouse(prompt: HouseMintPrompt) {
    await withWallet('Connect your wallet to mint a house.', async () => {
      store.setTxStatus(true, 'Minting verified house on-chain...')
      try {
        const client = createWriteClient(store.walletAddress)
        const tokenId = await mintHouse(
          client,
          prompt.tileX,
          prompt.tileY,
          prompt.widthTiles,
          prompt.heightTiles,
          'My House',
        )

        const newHouse = {
          tokenId,
          tileX: prompt.tileX,
          tileY: prompt.tileY,
          widthTiles: prompt.widthTiles,
          heightTiles: prompt.heightTiles,
          quality: 1,
          damaged: false,
          name: 'My House',
        }
        store.setHouses([...store.houses, newHouse])
        store.dismissHouseMint()
        store.setTxStatus(false, '')
        toast.success(`House minted! Token #${tokenId}`)

        upsertHouse(tokenId, store.walletAddress, {
          x: prompt.tileX,
          y: prompt.tileY,
          widthTiles: prompt.widthTiles,
          heightTiles: prompt.heightTiles,
          name: 'My House',
          quality: 1,
        }, false, 1).catch(() => { /* best-effort */ })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        store.setTxStatus(false, '')
        toast.error(`House mint failed: ${msg}`)
      }
    })
  }

  async function doSubmitEvent() {
    await withWallet('Connect your wallet to submit stats to the AI oracle.', async () => {
      if (!store.playerStats) return

      store.setTxStatus(true, 'Reading canonical state...')
      try {
        const client = createWriteClient(store.walletAddress)
        const canonical = await getPlayerState(store.walletAddress)
        const stats = store.playerStats
        const chainInventory = canonical?.inventory ?? {}

        const statsPayload = {
          health: stats.health,
          max_health: stats.maxHealth,
          energy: stats.energy,
          max_energy: stats.maxEnergy,
          xp: canonical?.xp ?? stats.xp,
          inventory: chainInventory,
          house_token_ids: store.houses.map(h => h.tokenId),
          days_survived: canonical?.days_survived ?? stats.dayNumber,
          zombies_killed: 0,
          resources_gathered: Object.values(chainInventory).reduce((a, b) => a + b, 0),
        }

        store.setTxStatus(true, 'Waiting for AI consensus (~30s)...')
        const resultJson = await submitPlayerStats(client, JSON.stringify(statsPayload))
        const result = JSON.parse(resultJson)

        const delta = {
          eventType: result.event_type,
          eventName: result.event_name,
          description: result.description,
          healthDelta: result.health_delta,
          energyDelta: result.energy_delta,
          xpDelta: result.xp_delta,
          inventoryDelta: result.inventory_delta ?? {},
          houseDamaged: result.house_damaged,
          houseDamageAmount: result.house_damage_amount,
          houseQualityDelta: result.house_quality_delta,
          reasoning: result.reasoning,
        }

        // Snapshot the oracle's full inventory delta (includes both gains and losses)
        // BEFORE calling apply_inventory_delta on-chain.  The contract only persists
        // losses (positive rewards are reserved for a future oracle-auth path), and it
        // returns { applied_delta, inventory, ... } — not the { deduct, grant } shape
        // that inventoryDeltaFromAction expects.  Overwriting inventoryDelta with the
        // return value would silently zero-out ALL inventory changes in the local event.
        const oracleInventoryDelta = { ...delta.inventoryDelta }

        store.setTxStatus(true, 'Applying AI effect on-chain...')
        await applyInventoryDeltaOnChain(
          client,
          `${store.epochInfo?.currentEpoch ?? 0}-${result.event_name}`,
          delta.inventoryDelta,
          delta.xpDelta,
        )

        // Restore the oracle's delta so the local game state reflects the full event
        // (gains for good events are applied locally even if not yet on-chain).
        delta.inventoryDelta = oracleInventoryDelta

        if (delta.houseDamaged && store.houses.length > 0) {
          await applyHouseEvent(
            client,
            store.houses[0].tokenId,
            true,
            delta.houseQualityDelta,
            `${store.epochInfo?.currentEpoch ?? 0}-${result.event_name}`,
          )
        }

        await updateProfile(client, JSON.stringify({
          name: store.playerName,
          house_count: store.houses.length,
        }))

        window.dispatchEvent(new CustomEvent('gensurvival:aiEvent', { detail: delta }))
        store.setLastAIEvent(delta)
        store.setTxStatus(false, '')
        toast.info(`AI Event: ${result.event_name}`)

        const latest = await getPlayerState(store.walletAddress)
        const epoch = store.epochInfo?.currentEpoch ?? 0
        Promise.all([
          upsertPlayer({
            address: store.walletAddress,
            name: store.playerName,
            score: latest?.score ?? 0,
            house_count: latest?.house_count ?? store.houses.length,
            days_survived: latest?.days_survived ?? stats.dayNumber,
            xp: latest?.xp ?? stats.xp,
          }),
          logAIEvent(store.walletAddress, epoch, result.event_type, result),
        ]).catch(() => { /* best-effort */ })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        store.setTxStatus(false, '')
        toast.error(`Submission failed: ${msg}`)
      }
    })
  }

  async function doFishTile(x: number, y: number) {
    return withWallet('Connect your wallet to fish on-chain.', async () => {
      store.setTxStatus(true, 'Fishing on-chain… 🎣')
      try {
        const client = createWriteClient(store.walletAddress)
        const delta = await fishTile(client, x, y)
        // Grant the caught item(s) locally
        const granted = Object.entries(delta.grant)
        const itemId  = granted[0]?.[0] ?? 'FISH'
        const count   = granted[0]?.[1] ?? 1
        // fishResult adds the item locally and shows the hint.
        // craftDelta is intentionally NOT dispatched here — fishResult already
        // applies the chain grant, and dispatching both would double-grant.
        window.dispatchEvent(new CustomEvent('gensurvival:fishResult', { detail: { itemId, count } }))
        store.setTxStatus(false, '')
        return delta
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        store.setTxStatus(false, '')
        // Fishing fails silently on chain error — give a local FISH as fallback
        window.dispatchEvent(new CustomEvent('gensurvival:fishResult', { detail: { itemId: 'FISH', count: 1 } }))
        toast.error(`Fishing tx failed (${msg}) — local fish granted`)
        return null
      }
    })
  }

  return { doCraft, doMineTile, doChopTree, doPlaceBuildTile, doMintHouse, doSubmitEvent, doFishTile }
}
