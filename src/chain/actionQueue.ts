import { createWriteClient } from './client'
import { settleActions, type SettleResult, type QueuedAction } from './contracts'

/**
 * Batches deterministic actions into one transaction.
 *
 * Every gather, placement and salvage used to be its own transaction and its
 * own wallet prompt — placing a 12x12 house meant 44 of them. The contract
 * verifies a batch exactly as it verifies single actions, so nothing is traded
 * away here except the round trips.
 *
 * What is deliberately NOT queued: mint_house, craft_freeform, refresh_world
 * and trigger_world_event. Those are the four calls where an AI actually
 * decides something, they are rare, and their results are what the player is
 * waiting to see. Keeping them immediate means every remaining wallet prompt
 * marks a moment of judgement rather than bookkeeping.
 */

/** Settle once the queue reaches this, well under the contract's cap of 50. */
const FLUSH_AT = 20
/** Or after this long, so a few actions do not sit unsettled indefinitely. */
const FLUSH_AFTER_MS = 12_000

let queue: QueuedAction[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let inFlight: Promise<SettleResult | null> | null = null
let getAddress: () => string | null = () => null

export function configureQueue(addressGetter: () => string | null): void {
  getAddress = addressGetter
}

export function pendingCount(): number {
  return queue.length
}

export function enqueue(action: QueuedAction): void {
  queue.push(action)
  if (queue.length >= FLUSH_AT) {
    void flush()
    return
  }
  if (timer === null) {
    timer = setTimeout(() => { void flush() }, FLUSH_AFTER_MS)
  }
}

/**
 * Settle everything queued.
 *
 * Must be awaited before anything that reads the chain's inventory — crafting
 * and house minting both spend it, and would otherwise be judged against a
 * state missing everything gathered since the last flush.
 */
export function flush(): Promise<SettleResult | null> {
  if (inFlight) return inFlight
  if (timer !== null) { clearTimeout(timer); timer = null }
  if (queue.length === 0) return Promise.resolve(null)

  const address = getAddress()
  if (!address) return Promise.resolve(null)

  const batch = queue
  queue = []

  inFlight = (async () => {
    try {
      const result = await settleActions(createWriteClient(address), batch)
      window.dispatchEvent(new CustomEvent('gensurvival:craftDelta', {
        detail: { deduct: result.deduct, grant: result.grant },
      }))
      if (result.rejected.length > 0) {
        window.dispatchEvent(new CustomEvent('gensurvival:settleRejected', {
          detail: result.rejected,
        }))
      }
      return result
    } catch (err) {
      // Put the batch back so a dropped connection does not silently erase
      // work. Duplicates are harmless: the contract rejects an action whose
      // one-shot key is already set, without failing the rest of the batch.
      queue = batch.concat(queue)
      throw err
    } finally {
      inFlight = null
      if (queue.length > 0 && timer === null) {
        timer = setTimeout(() => { void flush() }, FLUSH_AFTER_MS)
      }
    }
  })()

  return inFlight
}

/** Best-effort settle when the tab goes away. */
export function installUnloadFlush(): () => void {
  const onHide = () => { if (queue.length > 0) void flush() }
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide()
  })
  return () => window.removeEventListener('pagehide', onHide)
}
