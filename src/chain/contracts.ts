import { readClient, type GenLayerClient } from './client'
import { ADDRESSES } from './addresses'
import type { LeaderboardEntry } from '../ui/store'
import type { StationType } from '../game/registry/RECIPES'

/**
 * The contract keys everything by lowercase address. Wallets are inconsistent
 * about case, so normalise here too rather than relying on which RPC method
 * happened to supply the address.
 */
function normaliseAddressArgs(args: unknown[]): unknown[] {
  return args.map((a) =>
    typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a) ? a.toLowerCase() : a,
  )
}

async function readContract<T>(
  address: string,
  fn: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[] = [],
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (readClient as any).readContract({
    address: address as `0x${string}`,
    functionName: fn,
    args: normaliseAddressArgs(args),
    stateStatus: 'accepted', // read accepted state — no need to wait for finalization
  })
  return result as T
}

async function writeContract(
  client: GenLayerClient,
  address: string,
  fn: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
): Promise<unknown> {
  const hash = await client.writeContract({
    address: address as `0x${string}`,
    functionName: fn,
    args,
    value: BigInt(0),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const receipt = await (client as any).waitForTransactionReceipt({
    hash,
    status: 'FINALIZED',
    interval: 2000,  // poll every 2 s instead of the 5 s default
    retries: 60,     // up to 2 min total — enough for consensus
  }) as {
    returnValue?: unknown
    txExecutionResultName?: string
    consensus_data?: {
      leader_receipt?: Array<{ result?: { status?: string; payload?: unknown } }>
    }
  }

  // Guard: a tx can finalize with FINISHED_WITH_ERROR — the returnValue is then
  // an error string, not the expected payload. Throw so callers see a real error.
  if (receipt.txExecutionResultName === 'FINISHED_WITH_ERROR') {
    const leader  = receipt.consensus_data?.leader_receipt?.[0]
    const errText = typeof leader?.result?.payload === 'string'
      ? leader.result.payload
      : `Contract execution failed (${fn})`
    throw new Error(errText)
  }

  return receipt.returnValue
}

export interface PlayerChainState {
  address: string
  name: string
  inventory: Record<string, number>
  xp: number
  days_survived: number
  house_count: number
  score: number
  updated_at?: number
}

export interface ActionDelta {
  deduct: Record<string, number>
  grant: Record<string, number>
  inventory: Record<string, number>
  xp?: number
  score?: number
  placed?: {
    x: number
    y: number
    item_id: string
    tile: string
    kind: 'tile' | 'entity'
  }
}

// Returns true = registered, false = not registered, null = network/RPC error.
// Callers must NOT treat null the same as false — null means "unknown, don't show registration form".
export async function isRegistered(address: string): Promise<boolean | null> {
  try {
    return await readContract<boolean>(ADDRESSES.PLAYER_REGISTRY, 'is_registered', [address])
  } catch { return null }
}

export async function getProfile(address: string): Promise<{ name: string; score: number } | null> {
  try {
    const raw = await readContract<string>(ADDRESSES.PLAYER_REGISTRY, 'get_profile', [address])
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export async function registerPlayer(client: GenLayerClient, name: string): Promise<void> {
  await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'register', [name])
}

export async function updateProfile(client: GenLayerClient, profileJson: string): Promise<void> {
  await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'update_profile', [profileJson])
}

export async function getPlayerState(address: string): Promise<PlayerChainState | null> {
  try {
    const raw = await readContract<string>(ADDRESSES.PLAYER_REGISTRY, 'get_player_state', [address])
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export async function mineTile(client: GenLayerClient, x: number, y: number, terrainType: string): Promise<ActionDelta> {
  const raw = await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'mine_tile', [x, y, terrainType]) as string
  return JSON.parse(raw) as ActionDelta
}

export async function fishTile(client: GenLayerClient, x: number, y: number): Promise<ActionDelta> {
  const raw = await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'fish_tile', [x, y]) as string
  return JSON.parse(raw) as ActionDelta
}

export async function chopTree(client: GenLayerClient, x: number, y: number): Promise<ActionDelta> {
  const raw = await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'chop_tree', [x, y]) as string
  return JSON.parse(raw) as ActionDelta
}

export async function craftItem(
  client: GenLayerClient,
  recipeId: string,
  station: StationType,
  quantity: number,
  stationX = 0,
  stationY = 0,
): Promise<ActionDelta> {
  const raw = await writeContract(
    client,
    ADDRESSES.PLAYER_REGISTRY,
    'craft',
    [recipeId, station, quantity, stationX, stationY],
  ) as string
  return JSON.parse(raw) as ActionDelta
}

export async function placeBuildTile(
  client: GenLayerClient,
  x: number,
  y: number,
  itemId: string,
): Promise<ActionDelta> {
  const raw = await writeContract(
    client,
    ADDRESSES.PLAYER_REGISTRY,
    'place_build_tile',
    [x, y, itemId],
  ) as string
  return JSON.parse(raw) as ActionDelta
}

export async function mintHouse(
  client: GenLayerClient,
  x: number,
  y: number,
  width: number,
  height: number,
  name: string,
  description: string,
): Promise<number> {
  const tokenId = await writeContract(
    client,
    ADDRESSES.PLAYER_REGISTRY,
    'mint_house',
    [x, y, width, height, name, description],
  )
  return Number(tokenId)
}

/** The shared, AI-authored world era every player is currently subject to. */
export interface WorldEra {
  epoch: number
  era_name: string
  description: string
  danger_level: number
  bountiful_item: string
  scarce_item: string
  headline_basis: string
}

export async function getWorldEra(): Promise<WorldEra | null> {
  try {
    const raw = await readContract<string>(ADDRESSES.PLAYER_REGISTRY, 'get_world_era', [])
    return raw ? (JSON.parse(raw) as WorldEra) : null
  } catch { return null }
}

/**
 * Writes this epoch's shared world from real headlines. Permissionless and
 * idempotent per epoch: the first caller pays, everyone lives under the result.
 */
export async function refreshWorld(client: GenLayerClient): Promise<WorldEra> {
  const raw = await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'refresh_world', [])
  return JSON.parse(String(raw)) as WorldEra
}

export interface FreeformResult {
  success: boolean
  deduct: Record<string, number>
  grant: Record<string, number>
  verdict: string
  inventory: Record<string, number>
  xp: number
  score: number
}

/** Combine anything; the contract's LLM rules on what it makes. */
export async function craftFreeform(
  client: GenLayerClient,
  inputs: Record<string, number>,
  intent: string,
): Promise<FreeformResult> {
  const raw = await writeContract(
    client,
    ADDRESSES.PLAYER_REGISTRY,
    'craft_freeform',
    [JSON.stringify(inputs), intent],
  )
  return JSON.parse(String(raw)) as FreeformResult
}

export interface HouseMeta {
  token_id: number
  owner: string
  name: string
  description?: string
  structure_type?: string
  quality: number
  verdict?: string
  damaged: boolean
}

export async function getHouse(tokenId: number): Promise<HouseMeta | null> {
  try {
    const raw = await readContract<string>(ADDRESSES.PLAYER_REGISTRY, 'get_house', [tokenId])
    return raw ? (JSON.parse(raw) as HouseMeta) : null
  } catch { return null }
}

export async function claimGroundItem(client: GenLayerClient, x: number, y: number): Promise<ActionDelta> {
  const raw = await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'claim_ground_item', [x, y]) as string
  return JSON.parse(raw) as ActionDelta
}

export async function catchChicken(client: GenLayerClient, x: number, y: number): Promise<ActionDelta> {
  const raw = await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'catch_chicken', [x, y]) as string
  return JSON.parse(raw) as ActionDelta
}

export async function breakBuildTile(client: GenLayerClient, x: number, y: number): Promise<ActionDelta> {
  const raw = await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'break_build_tile', [x, y]) as string
  return JSON.parse(raw) as ActionDelta
}

export async function getHousesOf(address: string): Promise<number[]> {
  try {
    const raw = await readContract<string>(ADDRESSES.PLAYER_REGISTRY, 'get_houses_of', [address])
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const raw = await readContract<string>(ADDRESSES.PLAYER_REGISTRY, 'get_leaderboard', [])
    const data = JSON.parse(raw) as Array<{ address: string; score: number; name?: string }>
    return data.map(e => ({ address: e.address, score: e.score, name: e.name }))
  } catch { return [] }
}

export async function getCallCountToday(address: string): Promise<number> {
  try {
    return await readContract<number>(ADDRESSES.PLAYER_REGISTRY, 'get_call_count_today', [address])
  } catch { return 0 }
}

export async function recordSurvivalDay(client: GenLayerClient, dayNumber: number): Promise<void> {
  await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'record_survival_day', [dayNumber])
}

/**
 * Generates and applies this epoch's AI world event in a single transaction.
 *
 * Takes no arguments on purpose: the contract reads the player's inventory, xp
 * and houses from its own storage. The old call passed a client-authored stats
 * blob, so a player could declare whatever state suited them.
 */
export async function triggerWorldEvent(client: GenLayerClient): Promise<string> {
  const result = await writeContract(
    client,
    ADDRESSES.PLAYER_REGISTRY,
    'trigger_world_event',
    [],
  )
  return String(result)
}
