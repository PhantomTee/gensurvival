import { createClient } from '@supabase/supabase-js'

/**
 * Supabase mirror of on-chain progress. Purely for analytics - the in-game
 * leaderboard reads GenSurvivalGame.get_leaderboard() from the contract, not
 * these tables.
 *
 * The anon key is public by design (it ships in every client bundle), so it is
 * not a secret - but it IS a write credential for anyone who opens devtools.
 * Row Level Security policies on the Supabase project are what make these
 * tables trustworthy; without them the mirror accepts arbitrary rows. Reading
 * config from the environment keeps the project swappable and rotatable.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null

if (!supabase && import.meta.env.DEV) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are unset - ' +
      'analytics mirroring is disabled. Gameplay is unaffected.',
  )
}

// ─── Players ──────────────────────────────────────────────────────────────────

export interface PlayerRow {
  address:       string
  name:          string
  score:         number
  house_count:   number
  days_survived: number
  xp:            number
}

export async function upsertPlayer(p: PlayerRow): Promise<void> {
  if (!supabase) return
  await supabase.from('players').upsert({
    address:       p.address.toLowerCase(),
    name:          p.name,
    score:         p.score,
    house_count:   p.house_count,
    days_survived: p.days_survived,
    xp:            p.xp,
    updated_at:    new Date().toISOString(),
  }, { onConflict: 'address' })
}

// ─── Houses ───────────────────────────────────────────────────────────────────

export async function upsertHouse(
  tokenId: number,
  ownerAddress: string,
  metadata: { x: number; y: number; widthTiles: number; heightTiles: number; name: string; quality: number },
  damaged: boolean,
  quality: number,
): Promise<void> {
  if (!supabase) return
  await supabase.from('houses').upsert({
    token_id:      tokenId,
    owner_address: ownerAddress.toLowerCase(),
    tile_x:        metadata.x,
    tile_y:        metadata.y,
    width_tiles:   metadata.widthTiles,
    height_tiles:  metadata.heightTiles,
    name:          metadata.name,
    quality,
    damaged,
    updated_at:    new Date().toISOString(),
  }, { onConflict: 'token_id' })
}

// ─── Craft log ────────────────────────────────────────────────────────────────

export async function logCraft(
  address: string,
  recipeId: string,
  quantity: number,
  deduct: Record<string, number>,
  grant: Record<string, number>,
): Promise<void> {
  if (!supabase) return
  await supabase.from('craft_log').insert({
    player_address: address.toLowerCase(),
    recipe_id:      recipeId,
    quantity,
    inputs_json:    deduct,
    outputs_json:   grant,
  })
}

// ─── AI events ────────────────────────────────────────────────────────────────

export async function logAIEvent(
  address: string,
  epoch: number,
  eventType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
): Promise<void> {
  if (!supabase) return
  await supabase.from('ai_events').insert({
    player_address:      address.toLowerCase(),
    epoch,
    event_type:          eventType,
    event_name:          payload.event_name          ?? '',
    description:         payload.description         ?? '',
    health_delta:        payload.health_delta        ?? 0,
    energy_delta:        payload.energy_delta        ?? 0,
    xp_delta:            payload.xp_delta            ?? 0,
    inventory_delta_json: payload.inventory_delta    ?? {},
    house_damaged:       payload.house_damaged       ?? false,
    house_quality_delta: payload.house_quality_delta ?? 0,
    payload_json:        payload,
  })
}
