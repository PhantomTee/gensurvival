import { useState } from 'react'
import { useGameStore } from '../store'
import { useWallet } from '../hooks/useWallet'

function setGameTextInputFocus(focused: boolean) {
  window.dispatchEvent(new CustomEvent('gensurvival:textInputFocus', { detail: focused }))
}

export function WalletBadge() {
  const address = useGameStore((s) => s.walletAddress)
  const name = useGameStore((s) => s.playerName)
  const isRegistered = useGameStore((s) => s.isRegistered)
  const {
    connect,
    disconnect,
    completeRegistration,
    cancelRegistration,
    pendingRegistration,
    connecting,
  } = useWallet()
  const [playerName, setPlayerName] = useState('')

  const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null

  return (
    <>
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1 z-40" style={{ pointerEvents: 'auto' }}>
        {address ? (
          <div style={{
            background: 'linear-gradient(180deg,#2a1a0a 0%,#1a0f05 100%)',
            border: '2px solid #8b6914',
            borderRadius: 4,
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '2px 2px 0 #000, inset 0 1px 0 rgba(255,200,80,0.15)',
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isRegistered ? '#4ade80' : '#facc15',
              boxShadow: `0 0 6px ${isRegistered ? '#4ade80' : '#facc15'}`,
            }} />
            <span style={{ color: '#e8d5a0', fontFamily: "'Press Start 2P', monospace", fontSize: 12, fontWeight: 'bold' }}>
              {name || short}
            </span>
            <button onClick={disconnect} style={{
              color: '#8b6914',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 13,
              lineHeight: 1,
              marginLeft: 4,
            }} title="Disconnect">x</button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            style={{
              background: 'linear-gradient(180deg,#3d2200 0%,#1a0f00 100%)',
              border: '2px solid #c8860a',
              borderRadius: 4,
              color: '#f5c842',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 13,
              fontWeight: 'bold',
              padding: '6px 16px',
              cursor: connecting ? 'wait' : 'pointer',
              opacity: connecting ? 0.7 : 1,
              boxShadow: '2px 2px 0 #000, inset 0 1px 0 rgba(255,200,80,0.2)',
              letterSpacing: 1,
              textShadow: '0 0 8px rgba(245,200,66,0.5)',
            }}
          >
            {connecting ? 'CONNECTING...' : 'CONNECT EVM WALLET'}
          </button>
        )}
      </div>

      {pendingRegistration && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 80,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)',
        }}>
          <div style={{
            width: 360,
            maxWidth: 'calc(100vw - 32px)',
            background: 'linear-gradient(180deg,#1c1008 0%,#110900 100%)',
            border: '2px solid #c8860a',
            borderRadius: 6,
            padding: 18,
            boxShadow: '4px 4px 0 #000, 0 0 20px rgba(200,134,10,0.25)',
          }}>
            <h2 style={{
              color: '#f5c842',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 14,
              marginBottom: 12,
            }}>
              Create Profile
            </h2>
            <p style={{
              color: '#a38a52',
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 1.4,
              marginBottom: 12,
            }}>
              Choose the name shown on the leaderboard.
            </p>
            <input
              autoFocus
              value={playerName}
              maxLength={24}
              onChange={(e) => setPlayerName(e.target.value)}
              onFocus={() => setGameTextInputFocus(true)}
              onBlur={() => setGameTextInputFocus(false)}
              onKeyDownCapture={(e) => e.stopPropagation()}
              onKeyUpCapture={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') completeRegistration(playerName)
                if (e.key === 'Escape') cancelRegistration()
              }}
              placeholder="Wanderer"
              style={{
                width: '100%',
                background: '#080400',
                color: '#e8d5a0',
                border: '1px solid #8b6914',
                borderRadius: 4,
                padding: '9px 10px',
                fontFamily: 'monospace',
                fontSize: 15,
                outline: 'none',
                marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={connecting}
                onClick={() => completeRegistration(playerName)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  border: '1px solid #4ade80',
                  borderRadius: 4,
                  background: '#082000',
                  color: '#86efac',
                  cursor: connecting ? 'wait' : 'pointer',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 10,
                }}
              >
                {connecting ? 'CREATING...' : 'CREATE'}
              </button>
              <button
                disabled={connecting}
                onClick={cancelRegistration}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  border: '1px solid #5a3d10',
                  borderRadius: 4,
                  background: 'transparent',
                  color: '#a38a52',
                  cursor: connecting ? 'wait' : 'pointer',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 10,
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
