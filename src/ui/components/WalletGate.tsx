/**
 * WalletGate — full-screen overlay shown on the game screen while the wallet
 * connection flow is in progress.
 *
 * Reads walletPhase and walletConnecting from the store.
 * Calls walletActions.ts (plain async functions — no hooks) for sign-in
 * and registration so this component does NOT need to call useWallet().
 *
 * Phases rendered:
 *   checking    → spinner + "Verifying wallet…"
 *   needs-name  → name input + REGISTER & PLAY button
 *   needs-signin→ SIGN IN button (one-time personal_sign)
 *   idle/ready  → null (overlay hidden)
 *
 * CSS animation (.wallet-gate-spinner) lives in index.css to avoid React 19's
 * automatic <style> hoisting which caused error #185.
 */
import { useState } from 'react'
import { useGameStore } from '../store'
import {
  walletSignIn,
  walletCancelSignIn,
  walletCompleteRegistration,
  walletCancelRegistration,
} from '../hooks/walletActions'

const FONT: React.CSSProperties = { fontFamily: "'Press Start 2P', monospace" }

function setGameTextInputFocus(focused: boolean) {
  window.dispatchEvent(new CustomEvent('gensurvival:textInputFocus', { detail: focused }))
}

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
        color: '#556',
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
      {/* spinner class defined in index.css — avoids React 19 <style> hoisting issues */}
      <div className="wallet-gate-spinner" />
      <CardTitle>Verifying Wallet</CardTitle>
      <CardText>Checking your on-chain profile…</CardText>
    </Card>
  )
}

function SignInPanel({ connecting }: { connecting: boolean }) {
  const pending = useGameStore((s) => s.walletPending)

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
      <ActionBtn onClick={() => void walletSignIn()} disabled={connecting}>
        {connecting ? 'WAITING FOR WALLET...' : '✍  SIGN IN'}
      </ActionBtn>
      <GhostBtn onClick={walletCancelSignIn} disabled={connecting}>
        CANCEL
      </GhostBtn>
    </Card>
  )
}

function NamePanel({ connecting }: { connecting: boolean }) {
  // Prefill from the pending session so a player rejoining after a redeploy
  // confirms the name they already had rather than inventing a new one.
  const pendingName = useGameStore.getState().walletPending?.name ?? ''
  const [name, setName] = useState(pendingName)

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
          ref={(el) => {
            // React fires no blur on unmount, so release the game's keyboard
            // explicitly when this field goes away.
            if (el === null) setGameTextInputFocus(false)
          }}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onKeyUpCapture={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void walletCompleteRegistration(name)
            if (e.key === 'Escape') walletCancelRegistration()
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
      <ActionBtn onClick={() => void walletCompleteRegistration(name)} disabled={connecting}>
        {connecting ? 'REGISTERING...' : '⚔  REGISTER & PLAY'}
      </ActionBtn>
      <GhostBtn onClick={walletCancelRegistration} disabled={connecting}>
        CANCEL
      </GhostBtn>
    </Card>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function WalletGate() {
  const screen     = useGameStore((s) => s.screen)
  const phase      = useGameStore((s) => s.walletPhase)
  const connecting = useGameStore((s) => s.walletConnecting)

  if (screen !== 'game' || phase === 'ready' || phase === 'idle') return null

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: 'rgba(4,4,14,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'auto',
      backdropFilter: 'blur(2px)',
    }}>
      {phase === 'checking'     && <CheckingPanel />}
      {phase === 'needs-signin' && <SignInPanel connecting={connecting} />}
      {phase === 'needs-name'   && <NamePanel connecting={connecting} />}
    </div>
  )
}
