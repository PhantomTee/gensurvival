import { createNoise2D } from 'simplex-noise'
import {
  WORLD_SIZE, TILE_SIZE,
  NOISE_WATER, NOISE_SAND, NOISE_GRASS,
  SPAWN_FLOWER, SPAWN_CHICKEN, SPAWN_ZOMBIE, SPAWN_DOG,
} from '../constants'

// Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  return function () {
    seed += 0x6d2b79f5
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 32-bit avalanche mix, bit-identical to GenSurvivalGame._hash in
 * contracts/player_registry.py. Math.imul and >>> keep every step in exact
 * uint32 arithmetic, which is the only arithmetic both languages can agree on:
 * plain `*` overflows into float64 here, and `^` silently truncates to int32.
 */
function chainHash(x: number, y: number, salt: number): number {
  let h =
    (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 1442695041)) >>> 0
  h = (h ^ (h >>> 15)) >>> 0
  h = Math.imul(h, 2246822519) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 3266489917) >>> 0
  // The >>> 0 here is load-bearing: `^` yields a *signed* int32, so without it
  // a high-bit result goes negative and `% 10000` returns a negative index.
  h = (h ^ (h >>> 16)) >>> 0
  return h % 10000
}

function chainRockTile(tx: number, ty: number): 5 | 6 | 9 | null {
  const spawnQuarry = quarryRockTile(tx, ty)
  if (spawnQuarry != null) return spawnQuarry

  const region = chainHash(Math.floor(tx / 48), Math.floor(ty / 48), 11)
  const shoulder = chainHash(Math.floor(tx / 16), Math.floor(ty / 16), 13)
  const detail = chainHash(tx, ty, 17)
  const vein = chainHash(tx, ty, 29)
  const water = chainHash(Math.floor(tx / 7), Math.floor(ty / 7), 41)

  if (water < 650) return null
  if (region > 5400 && shoulder > 1400 && detail > 900) {
    if (vein > 9100) return 6
    if (vein > 7200) return 9
    return 5
  }
  return null
}

function quarryRockTile(tx: number, ty: number): 5 | 6 | 9 | null {
  const cx = Math.floor(WORLD_SIZE / 2) + 40
  const cy = Math.floor(WORLD_SIZE / 2) + 8
  const dx = tx - cx
  const dy = ty - cy
  // Scaled integer ellipse test, matching _quarry_rock_at in the contract.
  // Float division here used to disagree with the contract's integer form on
  // tiles right at the quarry boundary.
  const ridge = Math.floor((dx * dx * 10000) / (38 * 38)) +
                Math.floor((dy * dy * 10000) / (24 * 24))
  const chippedEdge = chainHash(tx, ty, 71) > 1150
  if (ridge > 10000 || !chippedEdge) return null

  const vein = chainHash(tx, ty, 73)
  if (vein > 9300) return 6
  if (vein > 7600) return 9
  return 5
}

// Must equal TREE_HASH_SALT / TREE_HASH_THRESHOLD in
// contracts/player_registry.py. Changing either side alone makes the contract
// reject legitimate chops.
const TREE_HASH_SALT = 53
const TREE_HASH_THRESHOLD = 850

/**
 * Tree placement, mirrored bit-for-bit by GenSurvivalGame._tree_exists_at in
 * contracts/player_registry.py. Trees must be derivable per coordinate so the
 * contract can verify a chop instead of trusting the client; the old
 * sequential-rng placement depended on chunk iteration order and could not be
 * reproduced on-chain.
 */
export function chainTreeAt(tx: number, ty: number): boolean {
  return chainHash(tx, ty, TREE_HASH_SALT) < TREE_HASH_THRESHOLD
}

// Remaining spawns are per-coordinate too, so a chunk generates the same
// contents no matter when or in what order it is visited. Bands are cumulative
// over 0..9999 and reproduce the previous 1/60, 1/200, 1/400, 1/500 rates.
const SPAWN_FLOWER_MAX  = 10000 / SPAWN_FLOWER                        // 167
const SPAWN_CHICKEN_MAX = SPAWN_FLOWER_MAX + 10000 / SPAWN_CHICKEN    // 217
const SPAWN_ZOMBIE_MAX  = SPAWN_CHICKEN_MAX + 10000 / SPAWN_ZOMBIE    // 242
const SPAWN_DOG_MAX     = SPAWN_ZOMBIE_MAX + 10000 / SPAWN_DOG        // 262

export interface SpawnDef {
  type: string   // EntityType or 'ITEM'
  tileX: number
  tileY: number
  itemId?: string  // only when type === 'ITEM'
  count?: number   // only when type === 'ITEM'
}

export interface GeneratedChunk {
  tiles: Uint8Array           // CHUNK_SIZE * CHUNK_SIZE, each = tile index
  spawns: SpawnDef[]
}

/**
 * Port of GenSurvival's WorldGenerator — Perlin noise + island falloff.
 * Uses simplex-noise (same algorithm family) with seeded PRNG.
 */
export class WorldGenerator {
  private noise2D: (x: number, y: number) => number
  private readonly worldSeed: number

  constructor(seed: number) {
    this.worldSeed = seed
    // Seed simplex via a derived hash
    this.noise2D = createNoise2D(mulberry32(seed))
  }

  /** Island falloff: 0 at edges → 1 at centre, based on Euclidean dist */
  private islandFalloff(nx: number, ny: number): number {
    const d = Math.sqrt(nx * nx + ny * ny)
    return 1 - Math.min(1, d * 1.15)
  }

  /** Composite noise at multiple octaves */
  private sample(tx: number, ty: number): number {
    const nx = (tx / WORLD_SIZE) * 2 - 1   // -1 .. 1
    const ny = (ty / WORLD_SIZE) * 2 - 1

    const n1 = this.noise2D(tx / 80,  ty / 80)  * 1.0
    const n2 = this.noise2D(tx / 40,  ty / 40)  * 0.5
    const n3 = this.noise2D(tx / 20,  ty / 20)  * 0.25
    const raw = (n1 + n2 + n3) / 1.75   // -1 .. 1
    const normalized = (raw + 1) / 2    //  0 .. 1

    return normalized * this.islandFalloff(nx, ny)
  }

  generateChunk(chunkX: number, chunkY: number, CHUNK_SIZE: number): GeneratedChunk {
    const tiles  = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE)
    const spawns: SpawnDef[] = []

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tx = chunkX * CHUNK_SIZE + lx
        const ty = chunkY * CHUNK_SIZE + ly
        const { tileIndex, walkable } = this.tileAt(tx, ty)

        tiles[ly * CHUNK_SIZE + lx] = tileIndex

        // Entity spawns on walkable tiles. Every roll below is a pure function
        // of the tile coordinate: trees have to be, because the contract
        // verifies them, and the rest follow for consistency.
        if (walkable) {
          if (chainTreeAt(tx, ty)) {
            spawns.push({ type: 'TREE', tileX: tx, tileY: ty })
          } else {
            const e = chainHash(tx, ty, 59)
            if      (e < SPAWN_FLOWER_MAX)  { spawns.push({ type: 'FLOWER',  tileX: tx, tileY: ty }) }
            else if (e < SPAWN_CHICKEN_MAX) { spawns.push({ type: 'CHICKEN', tileX: tx, tileY: ty }) }
            else if (e < SPAWN_ZOMBIE_MAX)  { spawns.push({ type: 'ZOMBIE',  tileX: tx, tileY: ty }) }
            else if (e < SPAWN_DOG_MAX)     { spawns.push({ type: 'DOG',     tileX: tx, tileY: ty }) }
          }

          // ── Scattered ground resources ─────────────────────────────────
          // Loose items visible on the ground: sticks, stones, ore chips.
          // These give the world visual richness and are permanent (lifetimeMs=0).
          const rItem = chainHash(tx, ty, 61)
          if (rItem < 20) {
            spawns.push({ type: 'ITEM', tileX: tx, tileY: ty, itemId: 'COAL', count: 1 })
          } else if (rItem < 60) {
            spawns.push({ type: 'ITEM', tileX: tx, tileY: ty, itemId: 'IRON_ORE', count: 1 })
          } else if (rItem < 120) {
            spawns.push({ type: 'ITEM', tileX: tx, tileY: ty, itemId: 'STONE', count: 1 })
          } else if (rItem < 200) {
            const itemId = chainHash(tx, ty, 67) < 6500 ? 'WOOD_STICK' : 'WOOD_LOG'
            spawns.push({ type: 'ITEM', tileX: tx, tileY: ty, itemId, count: 1 })
          }
        }
      }
    }

    return { tiles, spawns }
  }

  /** Find the best spawn tile for the player (first walkable GRASS tile near centre) */
  /**
   * The final tile at a coordinate — the single source of truth for what the
   * world looks like there.
   *
   * findSpawn used to re-derive this from raw simplex noise alone, ignoring the
   * rock overlay applied afterwards. Since the quarry sits at world-centre +40
   * on x and the search walked straight along +x, players were reliably dropped
   * into the middle of it.
   */
  tileAt(tx: number, ty: number): { tileIndex: number; walkable: boolean } {
    const v = this.sample(tx, ty)
    const rockTile = chainRockTile(tx, ty)

    let tileIndex: number
    let walkable = false

    if      (v < NOISE_WATER) { tileIndex = 1 }                  // WATER
    else if (v < NOISE_SAND)  { tileIndex = 2 }                  // SAND
    else if (v < NOISE_GRASS) { tileIndex = 4; walkable = true } // GRASS
    else                      { tileIndex = 4; walkable = true } // highland grass

    // Rocky biome: broad stone-land regions, not scattered boulders.
    if (walkable && v > NOISE_SAND + 0.03 && rockTile != null) {
      walkable = false
      tileIndex = rockTile
    }

    return { tileIndex, walkable }
  }

  /** True when a tile and everything within `pad` of it is open ground. */
  private isOpenGround(tx: number, ty: number, pad: number): boolean {
    for (let y = ty - pad; y <= ty + pad; y++) {
      for (let x = tx - pad; x <= tx + pad; x++) {
        if (!this.tileAt(x, y).walkable) return false
      }
    }
    return true
  }

  /**
   * Spiral out from world centre for genuinely open ground.
   *
   * Searching a ring rather than a single axis matters: the old +x-only scan
   * had no way to step around the quarry, so it either landed inside it or
   * against its edge.
   */
  findSpawn(): { x: number; y: number } {
    const cx = Math.floor(WORLD_SIZE / 2)
    const cy = Math.floor(WORLD_SIZE / 2)
    const at = (tx: number, ty: number) => ({
      x: tx * TILE_SIZE + TILE_SIZE / 2,
      y: ty * TILE_SIZE + TILE_SIZE / 2,
    })

    // Prefer a clearing with real breathing room, then relax the requirement.
    for (const pad of [3, 2, 1]) {
      for (let r = 0; r < 120; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
            if (this.isOpenGround(cx + dx, cy + dy, pad)) return at(cx + dx, cy + dy)
          }
        }
      }
    }
    return at(cx, cy)
  }
}
