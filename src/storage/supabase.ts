import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = 'https://xcaegihfnveszzexugpy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYWVnaWhmbnZlc3p6ZXh1Z3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTA3MjgsImV4cCI6MjA5NDUyNjcyOH0.HNn8K6ie4uyksmYsy_pxmFMrF87qiYXwVIcY8GFX_B4'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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
