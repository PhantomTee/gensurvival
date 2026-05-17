import { createClient, chains } from 'genlayer-js'

export const GENLAYER_STUDIONET = chains.studionet
export const GENLAYER_STUDIONET_CHAIN_ID_HEX = `0x${GENLAYER_STUDIONET.id.toString(16)}`

/** Read-only client for Studionet, no wallet required. */
export const readClient = createClient({ chain: GENLAYER_STUDIONET })

/**
 * Write client: injects the active EIP-1193 wallet provider for signing.
 * Must be called after eth_requestAccounts has succeeded.
 */
export function createWriteClient(account: string) {
  return createClient({
    chain: GENLAYER_STUDIONET,
    account: account as `0x${string}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: (window as any).ethereum,
  })
}

export type GenLayerClient = ReturnType<typeof createWriteClient>
