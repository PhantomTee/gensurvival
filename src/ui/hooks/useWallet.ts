/**
 * useWallet — hook responsible for:
 *   • auto-connect on page load (silent, no popup)
 *   • MetaMask account-change listener
 *   • manual connect() — shows MetaMask popup, kicks off the chain check
 *   • disconnect()
 *
 * sign-in / registration actions live in walletActions.ts (plain functions,
 * no hooks) so WalletGate can import them directly without calling useWallet().
 */
import { useEffect, useCallback } from 'react'
import { useGameStore } from '../store'
import { getOrCreateSeed } from '../../storage/SeedStorage'
import { loadSession, clearSession } from '../../storage/WalletSession'
import { isRegistered, getProfile } from '../../chain/contracts'
import { GENLAYER_STUDIONET, GENLAYER_STUDIONET_CHAIN_ID_HEX } from '../../chain/client'
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
        chainId:           GENLAYER_STUDIONET_CHAIN_ID_HEX,
        chainName:         GENLAYER_STUDIONET.name,
        rpcUrls:           [...GENLAYER_STUDIONET.rpcUrls.default.http],
        nativeCurrency:    GENLAYER_STUDIONET.nativeCurrency,
        blockExplorerUrls: GENLAYER_STUDIONET.blockExplorers?.default.url
          ? [GENLAYER_STUDIONET.blockExplorers.default.url]
          : undefined,
      }],
    })
  }
}

// ── Module-level guard so autoConnect only fires once per page load ───────────
let autoConnectRan = false

export function useWallet() {
  // Use individual selectors to avoid subscribing to the entire store
  const setWallet          = useGameStore((s) => s.setWallet)
  const clearWallet        = useGameStore((s) => s.clearWallet)
  const setWalletPhase     = useGameStore((s) => s.setWalletPhase)
  const setWalletPending   = useGameStore((s) => s.setWalletPending)
  const setWalletConnecting = useGameStore((s) => s.setWalletConnecting)
  const setScreen          = useGameStore((s) => s.setScreen)
  const walletConnecting   = useGameStore((s) => s.walletConnecting)

  // ── Auto-connect on page load (silent — no popup) ─────────────────────────
  const autoConnect = useCallback(async () => {
    if (autoConnectRan) return
    autoConnectRan = true

    const session = loadSession()
    if (!session || !window.ethereum) return

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[]
      const current  = accounts[0]?.toLowerCase()

      if (!current || current !== session.address.toLowerCase()) {
        clearSession()
        return
      }

      // Same account still unlocked → restore session immediately, no sign required.
      setWallet(session.address, session.name, true, session.seed)
      setWalletPhase('ready')
    } catch {
      // Silently fail
    }
  }, [setWallet, setWalletPhase])

  useEffect(() => {
    void autoConnect()
  }, [autoConnect])

  // ── MetaMask account-change listener ─────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts: unknown) => {
      const arr = accounts as string[]
      if (!arr || arr.length === 0) {
        clearSession()
        clearWallet()
        setWalletPhase('idle')
        setWalletPending(null)
        toast.info('Wallet disconnected.')
      } else {
        const session = loadSession()
        if (session && arr[0]?.toLowerCase() !== session.address.toLowerCase()) {
          clearSession()
          clearWallet()
          setWalletPhase('idle')
          setWalletPending(null)
          toast.info('Wallet account changed. Please reconnect.')
        }
      }
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
  }, [clearWallet, setWalletPhase, setWalletPending])

  // ── Manual connect (shows MetaMask popup) ─────────────────────────────────
  async function connect() {
    if (!window.ethereum) {
      toast.error('No EVM wallet found. Install or enable a browser wallet.')
      return
    }
    setWalletConnecting(true)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
      const address  = accounts[0]
      if (!address) return

      await ensureStudionet()

      const seed = getOrCreateSeed(address)

      // Enter game screen immediately so the WalletGate overlay appears
      setWalletPhase('checking')
      if (useGameStore.getState().screen !== 'game') {
        window.dispatchEvent(new CustomEvent('gensurvival:startWorld'))
      }

      const registered = await isRegistered(address)

      if (registered === null) {
        toast.error('Could not reach GenLayer network. Check your connection and try again.')
        setWalletPhase('idle')
        return
      }

      if (!registered) {
        setWalletPending({ address, seed, name: '' })
        setWalletPhase('needs-name')
        return
      }

      const profile    = await getProfile(address)
      const playerName = profile?.name ?? address.slice(0, 8)
      setWalletPending({ address, seed, name: playerName })
      setWalletPhase('needs-signin')

    } catch (err) {
      toast.error(`Wallet connect failed: ${friendlyWalletError(err)}`)
      setWalletPhase('idle')
    } finally {
      setWalletConnecting(false)
    }
  }

  // ── Disconnect ────────────────────────────────────────────────────────────
  function disconnect() {
    clearSession()
    clearWallet()
    setWalletPending(null)
    setWalletPhase('idle')
    setScreen('menu')
    toast.info('Wallet disconnected.')
  }

  return { connect, disconnect, walletConnecting }
}
