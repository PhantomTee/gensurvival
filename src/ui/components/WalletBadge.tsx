import { useState } from 'react'
import { useGameStore } from '../store'
import { useWallet } from '../hooks/useWallet'

const FONT: React.CSSProperties = { fontFamily: "'Press Start 2P', monospace" }

function setGameTextInputFocus(focused: boolean) {
  window.dispatchEvent(new CustomEvent('gensurvival:textInputFocus', { detail: focused }))
}

// ── Shared modal shell ──────────────────────────────────────────────────────
function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 80, pointerEvents: 'auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div style={{
        width: 380, maxWidth: 'calc(100vw - 32px)',
        background: 'linear-gradient(180deg,#1c1008 0%,#110900 100%)',
        border: '2px solid #c8860a',
        borderRadius: 6,
        padding: 20,
        boxShadow: '4px 4px 0 #000, 0 0 24px rgba(200,134,10,0.2)',
      }}>
        {children}
      </div>
    </div>
  )
}

function ModalTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ ...FONT, color: '#f5c842', fontSize: 13, marginBottom: 10 }}>
      {children}
    </h2>
  )
}

function ModalText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#a38a52', lineHeight: 1.5, marginBottom: 14 }}>
      {children}
    </p>
  )
}

function PrimaryBtn({ onClick, disabled, children }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '9px 10px',
        border: '1px solid #4ade80', borderRadius: 4,
        background: disabled ? '#0a0a0a' : '#082000',
        color: disabled ? '#3a5a20' : '#86efac',
        cursor: disabled ? 'wait' : 'pointer',
        ...FONT, fontSize: 10,
      }}
    >
      {children}
    </button>
  )
}

function SecondaryBtn({ onClick, disabled, children }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '9px 10px',
        border: '1px solid #5a3d10', borderRadius: 4,
        background: 'transparent',
        color: '#a38a52',
        cursor: disabled ? 'default' : 'pointer',
        ...FONT, fontSize: 10,
      }}
    >
      {children}
    </button>
  )
}

export function WalletBadge() {
  const address      = useGameStore((s) => s.walletAddress)
  const name         = useGameStore((s) => s.playerName)
  const isReg        = useGameStore((s) => s.isRegistered)
  const {
    connect, disconnect,
    signIn, cancelSignIn, pendingSignIn,
    completeRegistration, cancelRegistration, pendingRegistration,
    connecting,
  } = useWallet()
  const [playerName, setPlayerName] = useState('')

  const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null

  return (
    <>
      {/* ── Top-right badge ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
        zIndex: 40, pointerEvents: 'auto',
      }}>
        {address ? (
          <div style={{
            background: 'linear-gradient(180deg,#2a1a0a 0%,#1a0f05 100%)',
            border: '2px solid #8b6914', borderRadius: 4,
            padding: '4px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '2px 2px 0 #000, inset 0 1px 0 rgba(255,200,80,0.15)',
          }}>
            {/* Online dot */}
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
              x
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            style={{
              background: 'linear-gradient(180deg,#3d2200 0%,#1a0f00 100%)',
              border: '2px solid #c8860a', borderRadius: 4,
              color: '#f5c842',
              ...FONT, fontSize: 11, fontWeight: 'bold',
              padding: '6px 14px',
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

      {/* ── Sign-in modal (returning player) ────────────────────────────── */}
      {pendingSignIn && (
        <Modal>
          <ModalTitle>Sign In</ModalTitle>
          <ModalText>
            Welcome back, <strong style={{ color: '#f5c842' }}>{pendingSignIn.name}</strong>!
            <br /><br />
            Sign a message in your wallet to confirm ownership of<br />
            <span style={{ color: '#8b9db0', fontSize: 11 }}>{pendingSignIn.address}</span>
            <br /><br />
            No transaction is sent and no gas is spent.
          </ModalText>
          <div style={{ display: 'flex', gap: 8 }}>
            <PrimaryBtn onClick={signIn} disabled={connecting}>
              {connecting ? 'WAITING...' : 'SIGN IN'}
            </PrimaryBtn>
            <SecondaryBtn onClick={cancelSignIn} disabled={connecting}>
              CANCEL
            </SecondaryBtn>
          </div>
        </Modal>
      )}

      {/* ── Registration modal (new player) ─────────────────────────────── */}
      {pendingRegistration && (
        <Modal>
          <ModalTitle>Create Profile</ModalTitle>
          <ModalText>
            Choose the name shown on the leaderboard. You will approve one
            on-chain transaction to register.
          </ModalText>
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
              if (e.key === 'Enter') void completeRegistration(playerName)
              if (e.key === 'Escape') cancelRegistration()
            }}
            placeholder="Wanderer"
            style={{
              width: '100%',
              background: '#080400', color: '#e8d5a0',
              border: '1px solid #8b6914', borderRadius: 4,
              padding: '9px 10px',
              fontFamily: 'monospace', fontSize: 15,
              outline: 'none', marginBottom: 14,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <PrimaryBtn onClick={() => void completeRegistration(playerName)} disabled={connecting}>
              {connecting ? 'CREATING...' : 'CREATE & SIGN'}
            </PrimaryBtn>
            <SecondaryBtn onClick={cancelRegistration} disabled={connecting}>
              CANCEL
            </SecondaryBtn>
          </div>
        </Modal>
      )}
    </>
  )
}
