import { useEffect, useRef } from 'react'
import { useGameStore } from '../store'
import { getEpochInfo, getCallCountToday } from '../../chain/contracts'

/** Polls DisasterOracle.get_epoch_info every 60 seconds and updates the store */
export function useEpochInfo(): void {
  const address   = useGameStore((s) => s.walletAddress)
  const setEpoch  = useGameStore((s) => s.setEpochInfo)
  const timer     = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!address) return

    async function poll() {
      try {
        const [info, calls] = await Promise.all([
          getEpochInfo(),
          getCallCountToday(address),
        ])
        setEpoch({ ...info, callsToday: calls })
      } catch { /* network error — keep stale data */ }
    }

    poll()
    timer.current = setInterval(poll, 60_000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [address, setEpoch])
}
