/**
 * Standalone wallet action functions.
 *
 * These are plain async functions (NOT hooks) that operate directly on the
 * Zustand store via getState(). They are imported by WalletGate so that
 * component does not need to call useWallet() — avoiding a second hook
 * instance and the React 19 issues that come with it.
 */

import { useGameStore } from '../store'
import { saveSession } from '../../storage/WalletSession'
import { registerPlayer } from '../../chain/contracts'
import { createWriteClient } from '../../chain/client'
import { upsertPlayer } from '../../storage/supabase'
import { toast } from '../toast'

function friendlyWalletError(err: unknown): string {
  const raw   = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied'))
    return 'Wallet request was cancelled.'
  if (lower.includes('already pending'))
    return 'Your wallet has a pending request. Open MetaMask and finish or cancel it.'
  return raw
}

function persistAndSetWallet(address: string, name: string, seed: number) {
  const store = useGameStore.getState()
  saveSession({ address, name, seed, verifiedAt: Date.now() })
  store.setWallet(address, name, true, seed)
}

async function mirrorPlayer(address: string, name: string) {
  upsertPlayer({ address, name, score: 0, house_count: 0, days_survived: 0, xp: 0 })
    .catch(() => { /* best-effort */ })
}

// ── Sign-in challenge for returning players ───────────────────────────────────
export async function walletSignIn(): Promise<void> {
  const store = useGameStore.getState()
  const pending = store.walletPending
  if (!pending || !window.ethereum) return

  store.setWalletConnecting(true)
  try {
    const { address, seed, name } = pending
    const message =
      `Welcome to GenSurvival!\n\n` +
      `Signing this message proves wallet ownership.\n` +
      `No transaction is sent and no gas is spent.\n\n` +
      `Address: ${address}`

    await window.ethereum.request({ method: 'personal_sign', params: [message, address] })

    persistAndSetWallet(address, name, seed)
    store.setWalletPending(null)
    store.setWalletPhase('ready')
    toast.success(`Welcome back, ${name}!`)
    mirrorPlayer(address, name)
  } catch (err) {
    toast.error(`Sign in failed: ${friendlyWalletError(err)}`)
  } finally {
    useGameStore.getState().setWalletConnecting(false)
  }
}

export function walletCancelSignIn(): void {
  const store = useGameStore.getState()
  store.setWalletPending(null)
  store.setWalletPhase('idle')
  toast.info('Sign in cancelled.')
}

// ── Registration for new players ──────────────────────────────────────────────
export async function walletCompleteRegistration(playerName: string): Promise<void> {
  const store = useGameStore.getState()
  const pending = store.walletPending
  if (!pending) return

  const name = playerName.trim()
  if (!name) { toast.error('Choose a player name first.'); return }

  store.setWalletConnecting(true)
  try {
    toast.info('Creating on-chain profile — approve the transaction in your wallet...')
    const client = createWriteClient(pending.address)
    await registerPlayer(client, name)

    persistAndSetWallet(pending.address, name, pending.seed)
    store.setWalletPending(null)
    store.setWalletPhase('ready')
    toast.success(`Welcome to GenSurvival, ${name}!`)
    mirrorPlayer(pending.address, name)
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    toast.error(`Registration failed: ${raw}`)
  } finally {
    useGameStore.getState().setWalletConnecting(false)
  }
}

export function walletCancelRegistration(): void {
  const store = useGameStore.getState()
  store.setWalletPending(null)
  store.setWalletPhase('idle')
  toast.info('Wallet setup cancelled.')
}
