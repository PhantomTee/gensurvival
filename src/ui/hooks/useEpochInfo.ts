import { useEffect, useRef } from 'react'
import { useGameStore } from '../store'
import { getCallCountToday } from '../../chain/contracts'

// Mirror the constants in disaster_oracle.py — must stay in sync if contract changes.
const EPOCH_DURATION = 6 * 3600   // 6 hours in seconds
const CALL_WINDOW    = 1 * 3600   // 1 hour in seconds

/**
 * Epoch info is pure deterministic math — no contract call needed.
 * Computing it here eliminates the gen_call RPC round-trip entirely.
 */
function computeEpochInfo() {
  const now        = Math.floor(Date.now() / 1000)
  const epoch      = Math.floor(now / EPOCH_DURATION)
  const epochStart = epoch * EPOCH_DURATION
  const windowEnd  = epochStart + CALL_WINDOW
  const nextStart  = (epoch + 1) * EPOCH_DURATION
  const inWindow   = (now - epochStart) < CALL_WINDOW

  return {
    currentEpoch:              epoch,
    inWindow,
    secondsUntilNextWindow:    inWindow ? 0 : nextStart - now,
    windowEndTs:               windowEnd,
  }
}

/**
 * Polls epoch state every 30 seconds.
 * Epoch math is computed locally; only callsToday requires a contract read.
 * NOTE: getCallCountToday still calls the oracle contract view method.
 *       If that contract's get_call_count_today uses gl.message.timestamp
 *       (pre-redeploy), it will fail silently and return 0.
 */
export function useEpochInfo(): void {
  const address  = useGameStore((s) => s.walletAddress)
  const setEpoch = useGameStore((s) => s.setEpochInfo)
  const timer    = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!address) return

    async function poll() {
      const info = computeEpochInfo()
      let callsToday = 0
      try { callsToday = await getCallCountToday(address) } catch { /* keep 0 */ }
      setEpoch({ ...info, callsToday })
    }

    void poll()
    // 30s: fast enough to notice window open/close, cheap enough to not spam
    timer.current = setInterval(poll, 30_000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [address, setEpoch])
}
