export const TILE_SIZE = 16
export const CHUNK_SIZE = 16
export const MAX_SPEED = 48
export const WORLD_SIZE = 512

export const PLAYER_MAX_HEALTH = 3.0
export const PLAYER_MAX_ENERGY = 10.0
export const PLAYER_HEALTH_REGEN_COOLDOWN = 5000
export const PLAYER_ENERGY_REGEN_BASE = 0.01
export const PLAYER_INVENTORY_SLOTS = 64

export const ATTACK_COOLDOWN = 500
export const KNOCKBACK_FORCE = 80

// Real-world UTC+1 day cycle (total = 86 400 000 ms = 24 h).
// Cycle origin = 06:00 UTC+1 (dawn). makeDayNight() seeds totalElapsedMs from the clock.
export const DAY_STAGES = [
  { name: 'dawn',  duration:  7_200_000, ambientR: 255, ambientG: 200, ambientB: 160, alpha: 0.20 }, // 06:00–08:00
  { name: 'day',   duration: 43_200_000, ambientR: 255, ambientG: 255, ambientB: 255, alpha: 0.00 }, // 08:00–20:00
  { name: 'dusk',  duration:  7_200_000, ambientR: 255, ambientG: 160, ambientB:  80, alpha: 0.25 }, // 20:00–22:00
  { name: 'night', duration: 28_800_000, ambientR:  20, ambientG:  20, ambientB:  60, alpha: 0.65 }, // 22:00–06:00
]

// GenSurvival island thresholds: ocean first, then beach, then grass.
export const NOISE_WATER = 0.14
export const NOISE_SAND = 0.21
export const NOISE_GRASS = 0.78
export const NOISE_ROCK = 0.85

// Tree density lives in WorldGenerator.chainTreeAt, which must match the
// contract's hash rule exactly - it is not tunable from here.
export const SPAWN_FLOWER = 60
export const SPAWN_CHICKEN = 200
export const SPAWN_ZOMBIE = 400
export const SPAWN_DOG = 500

export const ENERGY_COST_ATTACK = 0.15
export const ENERGY_COST_MINE   = 0.30
export const ENERGY_COST_CHOP   = 0.50
export const STARVATION_THRESHOLD = 0.5   // energy below this → health drain
export const STARVATION_DRAIN_RATE = 0.05  // HP per second when starving

export const EPOCH_DURATION_MS = 6 * 60 * 60 * 1000
export const CALL_WINDOW_MS = 1 * 60 * 60 * 1000
export const MAX_CALLS_PER_DAY = 4

export const HOUSE_COST: Record<string, number> = {
  WOOD_PLANK: 40,
  STONE: 30,
  WOOD_WALL: 16,
  WOOD_FLOOR: 16,
  IRON_INGOT: 8,
  COAL: 5,
}
