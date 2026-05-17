import { useEffect } from 'react'
import { useGameStore } from '../store'
import { getLeaderboard } from '../../chain/contracts'

const MEDAL = ['🥇', '🥈', '🥉']

export function LeaderboardModal() {
  const open   = useGameStore((s) => s.leaderboardOpen)
  const toggle = useGameStore((s) => s.toggleLeaderboard)
  const list   = useGameStore((s) => s.leaderboard)
  const set    = useGameStore((s) => s.setLeaderboard)
  const me     = useGameStore((s) => s.walletAddress)

  useEffect(() => {
    if (!open) return
    getLeaderboard().then(set).catch(() => { /* best-effort */ })
  }, [open, set])

  if (!open) return null

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      background: 'linear-gradient(180deg,#1c1008 0%,#0e0700 100%)',
      border: '2px solid #8b6914',
      borderRadius: 6,
      boxShadow: '4px 4px 0 #000, inset 0 1px 0 rgba(255,200,80,0.1)',
      width: 320, maxHeight: '72vh', display: 'flex', flexDirection: 'column',
      zIndex: 50,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px',
        borderBottom: '1px solid #5a3d10',
      }}>
        <span style={{
          color: '#f5c842', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold',
          letterSpacing: 2, textShadow: '0 0 8px rgba(245,200,66,0.4)',
        }}>🏆 LEADERBOARD</span>
        <button onClick={toggle} style={{
          color: '#8b6914', background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'monospace', fontSize: 16,
        }}>✕</button>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 8px' }}>
        {list.length === 0 ? (
          <p style={{ color: '#6b5a30', fontFamily: 'monospace', fontSize: 12, textAlign: 'center', padding: 16 }}>
            Loading…
          </p>
        ) : list.slice(0, 50).map((entry, i) => {
          const isMe = me && entry.address.toLowerCase() === me.toLowerCase()
          return (
            <div key={entry.address} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 8px', borderRadius: 3, marginBottom: 2,
              background: isMe ? 'rgba(139,105,20,0.25)' : 'transparent',
              border: isMe ? '1px solid #8b6914' : '1px solid transparent',
            }}>
              <span style={{
                fontFamily: 'monospace', fontSize: 12, minWidth: 24, textAlign: 'right',
                color: i === 0 ? '#fbbf24' : i === 1 ? '#d1d5db' : i === 2 ? '#fb923c' : '#4a3820',
              }}>
                {MEDAL[i] ?? `${i + 1}.`}
              </span>
              <span style={{
                color: isMe ? '#f5c842' : '#c8a060', fontFamily: 'monospace', fontSize: 11,
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {entry.name || `${entry.address.slice(0, 6)}…${entry.address.slice(-4)}`}
                {isMe && <span style={{ color: '#f5c842', marginLeft: 4 }}>(you)</span>}
              </span>
              <span style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold' }}>
                {entry.score.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
