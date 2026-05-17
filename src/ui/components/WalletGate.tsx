/**
 * WalletGate — full-screen overlay shown on the game screen while the wallet
 * connection flow is in progress.
 *
 * Phases:
 *   checking    → spinner + "Verifying wallet…" (after MetaMask confirms address)
 *   needs-name  → name input + REGISTER & PLAY button (new player)
 *   needs-signin→ SIGN IN button (returning player, proves ownership once)
 *   idle/ready  → nothing rendered
 */
import { useState } from 'react'
import { useGameStore } from '../store'
import { useWallet } from '../hooks/useWallet'

const FONT: React.CSSProperties = { fontFamily: "'Press Start 2P', monospace" }

function setGameTextInputFocus(focused: boolean) {
  window.dispatchEvent(new CustomEvent('gensurvival:textInputFocus', { detail: focused }))
}

// ── Spinner animation (injected once) ────────────────────────────────────────
const SPIN_STYLE = `
@keyframes walletGateSpin {
  to { transform: rotate(360deg); }
}
.wallet-gate-spinner {
  width: 52px; height: 52px;
  border: 5px solid rgba(136,170,255,0.15);
  border-top-color: #88aaff;
  border-right-color: rgba(136,170,255,0.5);
  border-radius: 50%;
  animation: walletGateSpin 0.75s linear infinite;
}
`

// ── Shared card wrapper ───────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 400, maxWidth: 'calc(100vw - 32px)',
      background: 'linear-gradient(180deg,#0e0c1e 0%,#080614 100%)',
      border: '2px solid #4455aa',
      borderRadius: 8,
      padding: '28px 24px',
      boxShadow: '0 0 40px rgba(68,85,170,0.25), 4px 4px 0 #000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    }}>
      {children}
    </div>
  )
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ ...FONT, color: '#88aaff', fontSize: 14, margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
      {children}
    </h2>
  )
}

function CardText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#7080a0', lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
      {children}
    </p>
  )
}

function ActionBtn({ onClick, disabled, children }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '12px 16px',
        border: '2px solid #4ade80', borderRadius: 6,
        background: disabled ? '#050d05' : '#061206',
        color: disabled ? '#2a5030' : '#86efac',
        cursor: disabled ? 'wait' : 'pointer',
        ...FONT, fontSize: 11,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function GhostBtn({ onClick, disabled, children }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '10px 16px',
        border: '1px solid #334', borderRadius: 6,
        background: 'transparent',
        color: '#445',
        cursor: disabled ? 'default' : 'pointer',
        ...FONT, fontSize: 9,
      }}
    >
      {children}
    </button>
  )
}

// ── Phase panels ─────────────────────────────────────────────────────────────

function CheckingPanel() {
  return (
    <Card>
      <div className="wallet-gate-spinner" />
      <CardTitle>Verifying Wallet</CardTitle>
      <CardText>Checking your on-chain profile…</CardText>
    </Card>
  )
}

function SignInPanel({ connecting, signIn, cancel }: {
  connecting: boolean
  signIn: () => void
  cancel: () => void
}) {
  const pending = useGameStore(s => s.walletPending)

  return (
    <Card>
      <CardTitle>Welcome Back!</CardTitle>
      <CardText>
        Sign a short message to confirm wallet ownership.
        <br />No transaction is sent &amp; no gas is spent.
        {pending?.name && (
          <>
            <br /><br />
            <span style={{ color: '#f5c842', ...FONT, fontSize: 10 }}>{pending.name}</span>
          </>
        )}
      </CardText>
      <ActionBtn onClick={signIn} disabled={connecting}>
        {connecting ? 'WAITING FOR WALLET...' : '✍  SIGN IN'}
      </ActionBtn>
      <GhostBtn onClick={cancel} disabled={connecting}>
        CANCEL
      </GhostBtn>
    </Card>
  )
}

function NamePanel({ connecting, completeRegistration, cancel }: {
  connecting: boolean
  completeRegistration: (name: string) => void
  cancel: () => void
}) {
  const [name, setName] = useState('')

  return (
    <Card>
      <CardTitle>Create Your Profile</CardTitle>
      <CardText>
        Choose the name shown on the leaderboard.
        <br />One on-chain transaction registers you permanently.
      </CardText>
      <div style={{ width: '100%' }}>
        <input
          autoFocus
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setGameTextInputFocus(true)}
          onBlur={() => setGameTextInputFocus(false)}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onKeyUpCapture={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') completeRegistration(name)
            if (e.key === 'Escape') cancel()
          }}
          placeholder="Wanderer"
          style={{
            width: '100%',
            background: '#06040e', color: '#c8d8ff',
            border: '2px solid #334488', borderRadius: 6,
            padding: '11px 12px',
            fontFamily: 'monospace', fontSize: 15,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <ActionBtn onClick={() => completeRegistration(name)} disabled={connecting}>
        {connecting ? 'REGISTERING...' : '⚔  REGISTER & PLAY'}
      </ActionBtn>
      <GhostBtn onClick={cancel} disabled={connecting}>
        CANCEL
      </GhostBtn>
    </Card>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function WalletGate() {
  const screen  = useGameStore(s => s.screen)
  const phase   = useGameStore(s => s.walletPhase)
  const { signIn, cancelSignIn, completeRegistration, cancelRegistration, connecting } = useWallet()

  // Only render on the game screen and only when not yet ready
  if (screen !== 'game' || phase === 'ready' || phase === 'idle') return null

  return (
    <>
      <style>{SPIN_STYLE}</style>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 60,
        background: 'rgba(4,4,14,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'auto',
        backdropFilter: 'blur(2px)',
      }}>
        {phase === 'checking'    && <CheckingPanel />}
        {phase === 'needs-signin' && (
          <SignInPanel connecting={connecting} signIn={signIn} cancel={cancelSignIn} />
        )}
        {phase === 'needs-name'  && (
          <NamePanel connecting={connecting} completeRegistration={completeRegistration} cancel={cancelRegistration} />
        )}
      </div>
    </>
  )
}
