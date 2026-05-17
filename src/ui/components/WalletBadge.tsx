/**
 * WalletBadge — the small badge / button shown in the top-right corner at all times.
 *
 * Responsibilities:
 *   • If not connected: "CONNECT EVM WALLET" button that kicks off the wallet flow.
 *   • If connected:     Shows player name + a disconnect (×) button.
 *
 * All modals (sign-in prompt, registration form) are handled by WalletGate, which
 * renders as a full-screen overlay on the game screen.
 */
import { useGameStore } from '../store'
import { useWallet } from '../hooks/useWallet'

const FONT: React.CSSProperties = { fontFamily: "'Press Start 2P', monospace" }

export function WalletBadge() {
  const address = useGameStore((s) => s.walletAddress)
  const name    = useGameStore((s) => s.playerName)
  const isReg   = useGameStore((s) => s.isRegistered)
  const phase   = useGameStore((s) => s.walletPhase)
  const { connect, disconnect, connecting } = useWallet()

  const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
      zIndex: 40, pointerEvents: 'auto',
    }}>
      {address ? (
        /* ── Connected badge ── */
        <div style={{
          background: 'linear-gradient(180deg,#2a1a0a 0%,#1a0f05 100%)',
          border: '2px solid #8b6914', borderRadius: 4,
          padding: '4px 10px',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '2px 2px 0 #000, inset 0 1px 0 rgba(255,200,80,0.15)',
        }}>
          {/* Status dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isReg ? '#4ade80' : '#facc15',
            boxShadow: `0 0 6px ${isReg ? '#4ade80' : '#facc15'}`,
          }} />
          <span style={{ ...FONT, color: '#e8d5a0', fontSize: 11, fontWeight: 'bold' }}>
            {name || short}
          </span>
          <button
            onClick={disconnect}
            title="Disconnect wallet"
            style={{
              ...FONT, color: '#8b6914', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 13, lineHeight: 1, marginLeft: 4,
            }}
          >
            ×
          </button>
        </div>
      ) : (
        /* ── Connect button ── */
        <button
          onClick={connect}
          disabled={connecting || phase === 'checking'}
          style={{
            background: 'linear-gradient(180deg,#3d2200 0%,#1a0f00 100%)',
            border: '2px solid #c8860a', borderRadius: 4,
            color: '#f5c842',
            ...FONT, fontSize: 11, fontWeight: 'bold',
            padding: '6px 14px',
            cursor: (connecting || phase === 'checking') ? 'wait' : 'pointer',
            opacity: (connecting || phase === 'checking') ? 0.7 : 1,
            boxShadow: '2px 2px 0 #000, inset 0 1px 0 rgba(255,200,80,0.2)',
            letterSpacing: 1,
            textShadow: '0 0 8px rgba(245,200,66,0.5)',
          }}
        >
          {(connecting || phase === 'checking') ? 'CONNECTING...' : 'CONNECT EVM WALLET'}
        </button>
      )}
    </div>
  )
}
