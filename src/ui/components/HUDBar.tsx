import { useGameStore } from '../store'

function Bar({ value, max, color, icon }: { value: number; max: number; color: string; icon: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13, color, minWidth: 14, textAlign: 'center' }}>{icon}</span>
      <div style={{
        width: 120, height: 10,
        background: '#0e0700',
        border: '1px solid #5a3d10',
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.5)',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color,
          transition: 'width 0.2s',
          boxShadow: `0 0 4px ${color}`,
        }} />
      </div>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: '#a08040', minWidth: 48 }}>
        {value.toFixed(1)}/{max}
      </span>
    </div>
  )
}

export function HUDBar() {
  const stats       = useGameStore((s) => s.playerStats)
  const openCrafting = useGameStore((s) => s.openCrafting)

  if (!stats) return null

  const stageColor: Record<string, string> = {
    dawn: '#fb923c', day: '#fbbf24', dusk: '#f97316', night: '#93c5fd',
  }
  const sc = stageColor[stats.stageName] ?? '#e8d5a0'

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12,
      background: 'linear-gradient(180deg,#1c1008 0%,#110900 100%)',
      border: '2px solid #8b6914',
      borderRadius: 6,
      padding: '8px 12px',
      boxShadow: '3px 3px 0 #000, inset 0 1px 0 rgba(255,200,80,0.1)',
      display: 'flex', flexDirection: 'column', gap: 5,
      userSelect: 'none',
      pointerEvents: 'none',   /* stats area is non-interactive */
    }}>
      <Bar value={stats.health} max={stats.maxHealth} color="#ef4444" icon="♥" />
      <Bar value={stats.energy} max={stats.maxEnergy} color="#eab308" icon="⚡" />

      <div style={{
        height: 1,
        background: 'linear-gradient(90deg,transparent,#5a3d10,transparent)',
        margin: '2px 0',
      }} />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: '#4ade80' }}>
          XP {stats.xp}
        </span>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: sc }}>
          Day {stats.dayNumber} · {stats.stageName}
        </span>
      </div>

      {/* ── CRAFT button ── pointer-events override lets it receive clicks */}
      <button
        onClick={() => openCrafting('HAND', -1)}
        style={{
          pointerEvents: 'auto',
          marginTop: 2,
          background: 'linear-gradient(180deg,#2a1a00 0%,#150d00 100%)',
          border: '1px solid #c8860a',
          borderRadius: 3,
          color: '#f5c842',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 11,
          fontWeight: 'bold',
          padding: '4px 10px',
          cursor: 'pointer',
          letterSpacing: 1,
          textShadow: '0 0 6px rgba(245,200,66,0.4)',
          boxShadow: '1px 1px 0 #000',
          width: '100%',
        }}
        title="Open crafting panel (HAND recipes)"
      >
        ⚒ CRAFT
      </button>
    </div>
  )
}
