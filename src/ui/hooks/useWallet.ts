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
  const [connecting, setConnecting] = useState(false)

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

      // null = GenLayer RPC unreachable — don't show registration form or the
      // player could accidentally double-register when the network recovers.
      if (registered === null) {
        toast.error('Could not reach GenLayer network. Check your connection and try again.')
        return
      }

      if (!registered) {
        setPendingRegistration({ address, seed })
        return
      }

      const profile = await getProfile(address)
      const playerName = profile?.name ?? address.slice(0, 8)
      setWallet(address, playerName, true, seed)
      toast.success(`Welcome back, ${playerName}!`)
      mirrorPlayer(address, playerName)
    } catch (err) {
      toast.error(`Wallet connect failed: ${friendlyWalletError(err)}`)
    } finally {
      setConnecting(false)
    }
  }

  async function completeRegistration(playerName: string) {
    if (!pendingRegistration) return

    const name = playerName.trim()
    if (!name) {
      toast.error('Choose a player name first.')
      return
    }

    setConnecting(true)
    try {
      toast.info('Creating on-chain profile...')
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
    toast.info('Wallet disconnected.')
  }

  return {
    connect,
    disconnect,
    completeRegistration,
    cancelRegistration,
    pendingRegistration,
    connecting,
  }
}
