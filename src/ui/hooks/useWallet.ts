import { useState, useEffect, useCallback } from 'react'
import { useGameStore } from '../store'
import { getOrCreateSeed } from '../../storage/SeedStorage'
import { saveSession, loadSession, clearSession } from '../../storage/WalletSession'
import { isRegistered, registerPlayer, getProfile } from '../../chain/contracts'
import { createWriteClient, GENLAYER_STUDIONET, GENLAYER_STUDIONET_CHAIN_ID_HEX } from '../../chain/client'
import { upsertPlayer } from '../../storage/supabase'
import { toast } from '../toast'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

interface PendingRegistration { address: string; seed: number }
interface PendingSignIn       { address: string; seed: number; name: string }

function friendlyWalletError(err: unknown): string {
  const raw   = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied'))
    return 'Wallet request was cancelled.'
  if (lower.includes('already pending'))
    return 'Your wallet has a pending request. Open MetaMask and finish or cancel it.'
  if (lower.includes('chain') || lower.includes('network'))
    return 'Network mismatch. Switch your wallet to GenLayer Studionet and try again.'
  return raw
}

function walletErrorCode(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code
    return typeof code === 'number' ? code : undefined
  }
  return undefined
}

async function ensureStudionet() {
  const provider = window.ethereum
  if (!provider) throw new Error('No EVM wallet provider detected.')
  const currentChainId = await provider.request({ method: 'eth_chainId' }) as string
  if (currentChainId?.toLowerCase() === GENLAYER_STUDIONET_CHAIN_ID_HEX) return
  toast.info('Confirm the GenLayer Studionet network switch in your wallet.')
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: GENLAYER_STUDIONET_CHAIN_ID_HEX }],
    })
  } catch (err) {
    if (walletErrorCode(err) !== 4902) throw err
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId:         GENLAYER_STUDIONET_CHAIN_ID_HEX,
        chainName:       GENLAYER_STUDIONET.name,
        rpcUrls:         [...GENLAYER_STUDIONET.rpcUrls.default.http],
        nativeCurrency:  GENLAYER_STUDIONET.nativeCurrency,
        blockExplorerUrls: GENLAYER_STUDIONET.blockExplorers?.default.url
          ? [GENLAYER_STUDIONET.blockExplorers.default.url]
          : undefined,
      }],
    })
  }
}

// ── Module-level guard so autoConnect only fires once per page load ──────────
let autoConnectRan = false

export function useWallet() {
  const { setWallet, clearWallet } = useGameStore()
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null)
  const [pendingSignIn,       setPendingSignIn]       = useState<PendingSignIn | null>(null)
  const [connecting,          setConnecting]          = useState(false)

  // ── Helpers ────────────────────────────────────────────────────────────────

  function persistAndSetWallet(address: string, name: string, seed: number) {
    saveSession({ address, name, seed, verifiedAt: Date.now() })
    setWallet(address, name, true, seed)
  }

  async function mirrorPlayer(address: string, name: string) {
    upsertPlayer({ address, name, score: 0, house_count: 0, days_survived: 0, xp: 0 })
      .catch(() => { /* best-effort */ })
  }

  // ── Auto-connect on page load (silent — no popup, no modal) ───────────────
  const autoConnect = useCallback(async () => {
    if (autoConnectRan) return
    autoConnectRan = true

    const session = loadSession()
    if (!session || !window.ethereum) return

    try {
      // eth_accounts is silent — returns [] if MetaMask is locked, never shows popup
      const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[]
      const current  = accounts[0]?.toLowerCase()

      if (!current || current !== session.address.toLowerCase()) {
        // MetaMask locked or switched account → clear stale session
        clearSession()
        return
      }

      // Same account still unlocked → restore session immediately, no modal needed.
      // The player already proved ownership when they first signed in.
      setWallet(session.address, session.name, true, session.seed)
    } catch {
      // Silently fail — the user will just see the Connect button
    }
  }, [setWallet])

  useEffect(() => {
    void autoConnect()
  }, [autoConnect])

  // ── MetaMask account-change listener ───────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts: unknown) => {
      const arr = accounts as string[]
      if (!arr || arr.length === 0) {
        // MetaMask locked or disconnected
        clearSession()
        clearWallet()
        toast.info('Wallet disconnected.')
      } else {
        const session = loadSession()
        if (session && arr[0]?.toLowerCase() !== session.address.toLowerCase()) {
          // Switched to a different account — require fresh connect
          clearSession()
          clearWallet()
          toast.info('Wallet account changed. Please reconnect.')
        }
      }
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
  }, [clearWallet])

  // ── Manual connect (shows MetaMask popup) ─────────────────────────────────
  async function connect() {
    if (!window.ethereum) {
      toast.error('No EVM wallet found. Install or enable a browser wallet.')
      return
    }
    setConnecting(true)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
      const address  = accounts[0]
      if (!address) return

      await ensureStudionet()

      const seed       = getOrCreateSeed(address)
      const registered = await isRegistered(address)

      if (registered === null) {
        toast.error('Could not reach GenLayer network. Check your connection and try again.')
        return
      }

      if (!registered) {
        // New player — collect name, then sign the registration tx
        setPendingRegistration({ address, seed })
        return
      }

      // Returning player — require one-time personal_sign to prove ownership
      const profile    = await getProfile(address)
      const playerName = profile?.name ?? address.slice(0, 8)
      setPendingSignIn({ address, seed, name: playerName })

    } catch (err) {
      toast.error(`Wallet connect failed: ${friendlyWalletError(err)}`)
    } finally {
      setConnecting(false)
    }
  }

  // ── Sign-in challenge for returning players ───────────────────────────────
  async function signIn() {
    if (!pendingSignIn || !window.ethereum) return
    setConnecting(true)
    try {
      const { address, seed, name } = pendingSignIn
      const message =
        `Welcome to GenSurvival!\n\n` +
        `Signing this message proves wallet ownership.\n` +
        `No transaction is sent and no gas is spent.\n\n` +
        `Address: ${address}`

      await window.ethereum.request({ method: 'personal_sign', params: [message, address] })

      persistAndSetWallet(address, name, seed)
      setPendingSignIn(null)
      toast.success(`Welcome back, ${name}!`)
      mirrorPlayer(address, name)
    } catch (err) {
      toast.error(`Sign in failed: ${friendlyWalletError(err)}`)
    } finally {
      setConnecting(false)
    }
  }

  function cancelSignIn() {
    setPendingSignIn(null)
    toast.info('Sign in cancelled.')
  }

  // ── Registration for new players ──────────────────────────────────────────
  async function completeRegistration(playerName: string) {
    if (!pendingRegistration) return
    const name = playerName.trim()
    if (!name) { toast.error('Choose a player name first.'); return }

    setConnecting(true)
    try {
      toast.info('Creating on-chain profile — approve the transaction in your wallet...')
      const client = createWriteClient(pendingRegistration.address)
      await registerPlayer(client, name)

      persistAndSetWallet(pendingRegistration.address, name, pendingRegistration.seed)
      setPendingRegistration(null)
      toast.success(`Welcome to GenSurvival, ${name}!`)
      mirrorPlayer(pendingRegistration.address, name)
    } catch (err) {
      toast.error(`Registration failed: ${friendlyWalletError(err)}`)
    } finally {
      setConnecting(false)
    }
  }

  function cancelRegistration() {
    setPendingRegistration(null)
    toast.info('Wallet setup cancelled.')
  }

  // ── Disconnect ────────────────────────────────────────────────────────────
  function disconnect() {
    clearSession()
    clearWallet()
    setPendingRegistration(null)
    setPendingSignIn(null)
    toast.info('Wallet disconnected.')
  }

  return {
    connect, disconnect,
    signIn, cancelSignIn, pendingSignIn,
    completeRegistration, cancelRegistration, pendingRegistration,
    connecting,
  }
}
