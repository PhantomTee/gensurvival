import { createNoise2D } from 'simplex-noise'
import {
  WORLD_SIZE, TILE_SIZE,
  NOISE_WATER, NOISE_SAND, NOISE_GRASS,
  SPAWN_TREE, SPAWN_FLOWER, SPAWN_CHICKEN, SPAWN_ZOMBIE, SPAWN_DOG,
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

function chainHash(x: number, y: number, salt: number): number {
  let v = x * 374761393 + y * 668265263 + salt * 1442695041
  if (v < 0) v = -v
  v = (v ^ Math.floor(v / 1274126177)) * 1274126177
  if (v < 0) v = -v
  return Math.floor(v % 10000)
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
  const ridge = (dx * dx) / (38 * 38) + (dy * dy) / (24 * 24)
  const chippedEdge = chainHash(tx, ty, 71) > 1150
  if (ridge > 1 || !chippedEdge) return null

  const vein = chainHash(tx, ty, 73)
  if (vein > 9300) return 6
  if (vein > 7600) return 9
  return 5
}

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
  private rng: () => number
  private readonly worldSeed: number

  constructor(seed: number) {
    this.worldSeed = seed
    // Seed simplex via a derived hash
    const rng = mulberry32(seed)
    this.noise2D = createNoise2D(rng)
    this.rng     = mulberry32(seed ^ 0xdeadbeef)
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
    const rng = mulberry32(this.worldSeed ^ (chunkX * 73856093 ^ chunkY * 19349663))

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tx = chunkX * CHUNK_SIZE + lx
        const ty = chunkY * CHUNK_SIZE + ly
        const v  = this.sample(tx, ty)
        const rockTile = chainRockTile(tx, ty)

        let tileIndex: number
        let walkable = false

        if      (v < NOISE_WATER) { tileIndex = 1 }                         // WATER
        else if (v < NOISE_SAND)  { tileIndex = 2 }                         // SAND
        else if (v < NOISE_GRASS) { tileIndex = 4; walkable = true }        // GRASS
        else                       { tileIndex = 4; walkable = true }        // highland grass

        // Rocky biome: broad stone-land regions like upstream GenSurvival's rock
        // terrain layer. These are land tiles, not scattered object chunks.
        if (walkable && v > NOISE_SAND + 0.03 && rockTile != null) {
          walkable = false
          tileIndex = rockTile
        }

        tiles[ly * CHUNK_SIZE + lx] = tileIndex

        // Entity spawns on walkable tiles
        if (walkable) {
          const r = rng()

          const tTree    = 1 / SPAWN_TREE                         // 0.0833
          const tFlower  = tTree   + 1 / SPAWN_FLOWER             // 0.1000
          const tChicken = tFlower + 1 / SPAWN_CHICKEN            // 0.1050
          const tZombie  = tChicken + 1 / SPAWN_ZOMBIE            // 0.1075
          const tDog     = tZombie  + 1 / SPAWN_DOG               // 0.1095

          if      (r < tTree)    { spawns.push({ type: 'TREE',    tileX: tx, tileY: ty }) }
          else if (r < tFlower)  { spawns.push({ type: 'FLOWER',  tileX: tx, tileY: ty }) }
          else if (r < tChicken) { spawns.push({ type: 'CHICKEN', tileX: tx, tileY: ty }) }
          else if (r < tZombie)  { spawns.push({ type: 'ZOMBIE',  tileX: tx, tileY: ty }) }
          else if (r < tDog)     { spawns.push({ type: 'DOG',     tileX: tx, tileY: ty }) }

          // ── Scattered ground resources ─────────────────────────────────
          // Loose items visible on the ground: sticks, stones, ore chips.
          // These give the world visual richness and are permanent (lifetimeMs=0).
          const rItem = rng()
          if (rItem < 0.002) {
            spawns.push({ type: 'ITEM', tileX: tx, tileY: ty, itemId: 'COAL', count: 1 })
          } else if (rItem < 0.006) {
            spawns.push({ type: 'ITEM', tileX: tx, tileY: ty, itemId: 'IRON_ORE', count: 1 })
          } else if (rItem < 0.012) {
            spawns.push({ type: 'ITEM', tileX: tx, tileY: ty, itemId: 'STONE', count: 1 })
          } else if (rItem < 0.020) {
            const rv = rng()
            const itemId = rv < 0.65 ? 'WOOD_STICK' : 'WOOD_LOG'
            spawns.push({ type: 'ITEM', tileX: tx, tileY: ty, itemId, count: 1 })
          }
        }
      }
    }

    return { tiles, spawns }
  }

  /** Find the best spawn tile for the player (first walkable GRASS tile near centre) */
  findSpawn(): { x: number; y: number } {
    const cx = Math.floor(WORLD_SIZE / 2)
    const cy = Math.floor(WORLD_SIZE / 2)
    for (let r = 0; r < 50; r++) {
      const v = this.sample(cx + r, cy)
      if (v >= NOISE_SAND && v < NOISE_GRASS) {
        return {
          x: (cx + r) * TILE_SIZE + TILE_SIZE / 2,
          y: cy       * TILE_SIZE + TILE_SIZE / 2,
        }
      }
    }
    return { x: cx * TILE_SIZE, y: cy * TILE_SIZE }
  }
}
