import { useState } from 'react'
import { useGameStore } from '../store'
import { getOrCreateSeed } from '../../storage/SeedStorage'
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

interface PendingRegistration {
  address: string
  seed: number
}

interface PendingSignIn {
  address: string
  seed: number
  name: string
}

function friendlyWalletError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()

  if (lower.includes('user rejected') || lower.includes('user denied')) {
    return 'Wallet request was cancelled.'
  }
  if (lower.includes('already pending')) {
    return 'Your wallet already has a pending request. Open it and finish or cancel that request.'
  }
  if (lower.includes('chain') || lower.includes('network')) {
    return 'Wallet network mismatch. Switch your wallet to GenLayer Studionet and try again.'
  }

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
        chainId: GENLAYER_STUDIONET_CHAIN_ID_HEX,
        chainName: GENLAYER_STUDIONET.name,
        rpcUrls: [...GENLAYER_STUDIONET.rpcUrls.default.http],
        nativeCurrency: GENLAYER_STUDIONET.nativeCurrency,
        blockExplorerUrls: GENLAYER_STUDIONET.blockExplorers?.default.url
          ? [GENLAYER_STUDIONET.blockExplorers.default.url]
          : undefined,
      }],
    })
  }
}

export function useWallet() {
  const { setWallet, clearWallet } = useGameStore()
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null)
  const [pendingSignIn, setPendingSignIn]             = useState<PendingSignIn | null>(null)
  const [connecting, setConnecting]                   = useState(false)

  async function mirrorPlayer(address: string, playerName: string) {
    upsertPlayer({
      address,
      name: playerName,
      score: 0,
      house_count: 0,
      days_survived: 0,
      xp: 0,
    }).catch(() => { /* best-effort */ })
  }

  // ── Step 1: Connect wallet + check registration ────────────────────────────
  async function connect() {
    if (!window.ethereum) {
      toast.error('No EVM wallet found. Install or enable a browser wallet to play GenSurvival.')
      return
    }

    setConnecting(true)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
      const address = accounts[0]
      if (!address) return
      await ensureStudionet()

      const seed = getOrCreateSeed(address)
      const registered = await isRegistered(address)

      // null = GenLayer RPC unreachable — don't show any form; the player could
      // accidentally double-register when the network recovers.
      if (registered === null) {
        toast.error('Could not reach GenLayer network. Check your connection and try again.')
        return
      }

      if (!registered) {
        // New player — ask for a name, then sign the registration tx.
        setPendingRegistration({ address, seed })
        return
      }

      // Existing player — require a MetaMask signature before granting access.
      const profile = await getProfile(address)
      const playerName = profile?.name ?? address.slice(0, 8)
      setPendingSignIn({ address, seed, name: playerName })
    } catch (err) {
      toast.error(`Wallet connect failed: ${friendlyWalletError(err)}`)
    } finally {
      setConnecting(false)
    }
  }

  // ── Step 2a (returning player): Sign a challenge message ──────────────────
  async function signIn() {
    if (!pendingSignIn || !window.ethereum) return

    setConnecting(true)
    try {
      const { address, seed, name } = pendingSignIn
      const message =
        `Welcome to GenSurvival!\n\n` +
        `Signing this message proves wallet ownership.\n` +
        `No transaction is made and no gas is spent.\n\n` +
        `Address: ${address}`

      await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      })

      setWallet(address, name, true, seed)
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

  // ── Step 2b (new player): Choose name + sign registration tx ──────────────
  async function completeRegistration(playerName: string) {
    if (!pendingRegistration) return

    const name = playerName.trim()
    if (!name) {
      toast.error('Choose a player name first.')
      return
    }

    setConnecting(true)
    try {
      toast.info('Creating on-chain profile — approve the transaction in your wallet...')
      const client = createWriteClient(pendingRegistration.address)
      await registerPlayer(client, name)
      setWallet(pendingRegistration.address, name, true, pendingRegistration.seed)
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

  function disconnect() {
    clearWallet()
    setPendingRegistration(null)
    setPendingSignIn(null)
    toast.info('Wallet disconnected.')
  }

  return {
    connect,
    disconnect,
    signIn,
    cancelSignIn,
    completeRegistration,
    cancelRegistration,
    pendingSignIn,
    pendingRegistration,
    connecting,
  }
}
