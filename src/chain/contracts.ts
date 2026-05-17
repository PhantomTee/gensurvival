import { readClient, type GenLayerClient } from './client'
import { ADDRESSES } from './addresses'
import type { EpochInfo, LeaderboardEntry } from '../ui/store'
import type { StationType } from '../game/registry/RECIPES'

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
    args,
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
  })
  return (receipt as { returnValue?: unknown }).returnValue
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
): Promise<number> {
  const tokenId = await writeContract(
    client,
    ADDRESSES.PLAYER_REGISTRY,
    'mint_house',
    [x, y, width, height, name],
  )
  return Number(tokenId)
}

export async function applyInventoryDeltaOnChain(
  client: GenLayerClient,
  eventId: string,
  delta: Record<string, number>,
  xpDelta: number,
): Promise<ActionDelta> {
  const raw = await writeContract(
    client,
    ADDRESSES.PLAYER_REGISTRY,
    'apply_inventory_delta',
    [eventId, JSON.stringify(delta), xpDelta],
  ) as string
  return JSON.parse(raw) as ActionDelta
}

export async function applyHouseEvent(
  client: GenLayerClient,
  tokenId: number,
  damaged: boolean,
  qualityDelta: number,
  eventId: string,
): Promise<void> {
  await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'apply_house_event', [tokenId, damaged, qualityDelta, eventId])
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

export async function getEpochInfo(): Promise<Omit<EpochInfo, 'callsToday'>> {
  try {
    const raw = await readContract<string>(ADDRESSES.DISASTER_ORACLE, 'get_epoch_info', [])
    const data = JSON.parse(raw)
    return {
      currentEpoch: data.current_epoch,
      inWindow: data.in_window,
      secondsUntilNextWindow: data.seconds_until_next_window,
      windowEndTs: data.window_end,
    }
  } catch {
    return { currentEpoch: 0, inWindow: false, secondsUntilNextWindow: 0, windowEndTs: 0 }
  }
}

export async function getCallCountToday(address: string): Promise<number> {
  try {
    return await readContract<number>(ADDRESSES.DISASTER_ORACLE, 'get_call_count_today', [address])
  } catch { return 0 }
}

export async function recordSurvivalDay(client: GenLayerClient, dayNumber: number): Promise<void> {
  await writeContract(client, ADDRESSES.PLAYER_REGISTRY, 'record_survival_day', [dayNumber])
}

export async function submitPlayerStats(
  client: GenLayerClient,
  statsJson: string,
): Promise<string> {
  const result = await writeContract(
    client,
    ADDRESSES.DISASTER_ORACLE,
    'submit_player_stats',
    [statsJson],
  )
  return String(result)
}
