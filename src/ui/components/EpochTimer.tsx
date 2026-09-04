import { useEffect } from 'react'
import { useGameStore } from '../store'
import { useChainActions } from '../hooks/useChainActions'
import { useEpochInfo } from '../hooks/useEpochInfo'
import { getWorldEra } from '../../chain/contracts'

const DANGER_LABEL = ['', 'Calm', 'Uneasy', 'Tense', 'Dangerous', 'Dire']

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function EpochTimer() {
  const epochInfo = useGameStore((s) => s.epochInfo)
  const txPending = useGameStore((s) => s.txPending)
  const txStatus  = useGameStore((s) => s.txStatus)
  const address   = useGameStore((s) => s.walletAddress)
  const worldEra    = useGameStore((s) => s.worldEra)
  const setWorldEra = useGameStore((s) => s.setWorldEra)
  const { doSubmitEvent, doRefreshWorld } = useChainActions()
  useEpochInfo()   // starts polling

  // The shared era is global state, so read it on mount and whenever the epoch
  // turns over - another player may have written this epoch's world already.
  useEffect(() => {
    if (!address) return
    let cancelled = false
    void getWorldEra().then((era) => { if (!cancelled && era) setWorldEra(era) })
    return () => { cancelled = true }
  }, [address, setWorldEra, epochInfo?.currentEpoch])

  if (!address) return null

  const eraIsStale = worldEra != null && epochInfo != null
    && worldEra.epoch !== epochInfo.currentEpoch

  const calls   = epochInfo?.callsToday ?? 0
  const inWin   = epochInfo?.inWindow ?? false
  const secLeft = epochInfo?.secondsUntilNextWindow ?? 0
  const canCall = inWin && calls < 4 && !txPending

  return (
    <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1 z-40 select-none">
      {/* Shared world era — the same for every player, written from real news */}
      {worldEra && (
        <div className="bg-gray-900 border border-amber-800/60 rounded px-3 py-1 text-right max-w-64">
          <div className="text-amber-300 text-xs font-mono font-bold">
            {worldEra.era_name}
          </div>
          <div className="text-gray-400 text-[10px] font-mono">
            {DANGER_LABEL[worldEra.danger_level] ?? 'Unknown'}
            {worldEra.bountiful_item && ` · ${worldEra.bountiful_item.replace(/_/g, ' ').toLowerCase()} is plentiful`}
          </div>
          {worldEra.scarce_item && (
            <div className="text-gray-500 text-[10px] font-mono">
              {worldEra.scarce_item.replace(/_/g, ' ').toLowerCase()} is scarce
            </div>
          )}
        </div>
      )}

      {/* Nobody has written this epoch's world yet — anyone may */}
      {eraIsStale && !txPending && (
        <button
          onClick={doRefreshWorld}
          className="px-3 py-1 rounded border border-amber-600 text-amber-300 bg-amber-900/30
                     hover:bg-amber-800/50 font-mono text-xs cursor-pointer">
            READ TODAY'S WORLD
        </button>
      )}

      {/* Epoch status */}
      <div className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-right">
        <div className="text-gray-400 text-xs font-mono">
          {inWin ? '🟢 SUBMIT WINDOW OPEN' : '⏳ Next window in'}
        </div>
        {!inWin && (
          <div className="text-blue-300 text-sm font-mono font-bold">
            {formatSeconds(secLeft)}
          </div>
        )}
        <div className="text-gray-500 text-xs font-mono">
          Calls today: {calls}/4
        </div>
      </div>

      {/* Submit button — only shown during call window */}
      {inWin && (
        <button
          disabled={!canCall}
          onClick={doSubmitEvent}
          className={`px-4 py-2 rounded border font-mono font-bold text-sm transition-all
            ${canCall
              ? 'border-green-500 text-green-300 bg-green-900/40 hover:bg-green-800/60 animate-pulse cursor-pointer'
              : calls >= 4
                ? 'border-gray-600 text-gray-500 bg-gray-900 cursor-not-allowed'
                : 'border-yellow-600 text-yellow-400 bg-yellow-900/30 cursor-not-allowed'}`}>
          {calls >= 4 ? 'LIMIT REACHED' : txPending ? '⟳ SUBMITTING…' : '⚡ SUBMIT STATS'}
        </button>
      )}

      {/* Tx status */}
      {txPending && (
        <div className="bg-gray-900 border border-yellow-700 rounded px-3 py-1 text-right max-w-48">
          <p className="text-yellow-300 text-xs font-mono animate-pulse">{txStatus}</p>
        </div>
      )}
    </div>
  )
}
