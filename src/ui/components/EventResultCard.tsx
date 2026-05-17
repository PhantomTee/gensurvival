import { useGameStore } from '../store'
import { ITEMS } from '../../game/registry/ITEMS'
import type { ItemId } from '../../game/registry/ITEMS'

export function EventResultCard() {
  const event    = useGameStore((s) => s.lastAIEvent)
  const setEvent = useGameStore((s) => s.setLastAIEvent)

  if (!event) return null

  const isGood     = event.eventType === 'good'
  const isDisaster = event.eventType === 'disaster'

  const borderColor = isGood ? 'border-green-500' : isDisaster ? 'border-red-500' : 'border-yellow-500'
  const titleColor  = isGood ? 'text-green-300'  : isDisaster ? 'text-red-300'   : 'text-yellow-300'

  function fmtDelta(n: number, unit = ''): string {
    if (n === 0) return ''
    return `${n > 0 ? '+' : ''}${n.toFixed(1)}${unit}`
  }

  const deltas = [
    event.healthDelta !== 0 && `♥ ${fmtDelta(event.healthDelta)}`,
    event.energyDelta !== 0 && `⚡ ${fmtDelta(event.energyDelta)}`,
    event.xpDelta     !== 0 && `XP ${fmtDelta(event.xpDelta, '')}`,
  ].filter(Boolean) as string[]

  const invDeltas = Object.entries(event.inventoryDelta).filter(([, v]) => v !== 0)

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-60
                    max-w-sm w-full bg-gray-950 rounded-xl shadow-2xl
                    border-2 animate-in fade-in"
         style={{ borderColor: isGood ? '#22c55e' : isDisaster ? '#ef4444' : '#eab308' }}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${borderColor}`}>
        <div className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-1">
          {event.eventType} event
        </div>
        <h2 className={`font-bold font-mono text-lg ${titleColor}`}>{event.eventName}</h2>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        <p className="text-gray-300 text-sm font-mono leading-relaxed">{event.description}</p>

        {/* Stat deltas */}
        {deltas.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {deltas.map(d => (
              <span key={d} className={`text-xs font-mono px-2 py-1 rounded border
                ${d.startsWith('+') || (!d.startsWith('-'))
                  ? 'border-green-700 text-green-300 bg-green-900/30'
                  : 'border-red-700 text-red-300 bg-red-900/30'}`}>
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Inventory changes */}
        {invDeltas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {invDeltas.map(([id, amt]) => {
              const def = ITEMS[id as ItemId]
              const positive = amt > 0
              return (
                <span key={id} className={`text-xs font-mono px-2 py-0.5 rounded
                  ${positive ? 'text-green-400 bg-green-900/40' : 'text-red-400 bg-red-900/40'}`}>
                  {positive ? '+' : ''}{amt} {def?.displayName ?? id}
                </span>
              )
            })}
          </div>
        )}

        {/* House damage */}
        {event.houseDamaged && (
          <p className="text-red-400 text-xs font-mono">
            🏠 House damaged (severity: {event.houseDamageAmount})
          </p>
        )}

        {/* AI reasoning (collapsed) */}
        <details className="text-gray-500 text-xs font-mono">
          <summary className="cursor-pointer hover:text-gray-400">AI reasoning…</summary>
          <p className="mt-1 leading-relaxed">{event.reasoning}</p>
        </details>
      </div>

      {/* Close */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setEvent(null as unknown as typeof event)}
          className="w-full py-2 rounded border border-gray-600 text-gray-300
                     text-xs font-mono hover:border-gray-400 hover:text-white transition-colors">
          CLOSE
        </button>
      </div>
    </div>
  )
}
