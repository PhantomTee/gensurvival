import type { ItemId } from '../registry/ITEMS'

// ─── Health ───────────────────────────────────────────────────────────────────
export interface HealthComponent {
  value: number
  max: number
  regenCooldownMs: number  // ms remaining before next natural regen tick
  invincibleMs: number     // ms of i-frames remaining after hit
}

export function makeHealth(max: number): HealthComponent {
  return { value: max, max, regenCooldownMs: 0, invincibleMs: 0 }
}

// ─── Energy ───────────────────────────────────────────────────────────────────
export interface EnergyComponent {
  value: number
  max: number
  regenRate: number  // current regen rate (increases each step, resets on use)
}

export function makeEnergy(max: number): EnergyComponent {
  return { value: max, max, regenRate: 0.01 }
}

// ─── Experience ───────────────────────────────────────────────────────────────
export interface ExperienceComponent {
  xp: number
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export interface InventoryComponent {
  items: Map<ItemId, number>
  maxSlots: number
  hotbarIndex: number    // currently selected hotbar slot (0-8)
  hotbar: (ItemId | null)[]
}

export function makeInventory(slots = 64): InventoryComponent {
  return {
    items: new Map(),
    maxSlots: slots,
    hotbarIndex: 0,
    hotbar: new Array(9).fill(null),
  }
}

export function addItem(inv: InventoryComponent, id: ItemId, count = 1): boolean {
  const cur = inv.items.get(id) ?? 0
  inv.items.set(id, cur + count)
  return true
}

export function removeItem(inv: InventoryComponent, id: ItemId, count = 1): boolean {
  const cur = inv.items.get(id) ?? 0
  if (cur < count) return false
  if (cur === count) inv.items.delete(id)
  else inv.items.set(id, cur - count)
  return true
}

export function hasItems(inv: InventoryComponent, needs: Partial<Record<ItemId, number>>): boolean {
  for (const [id, qty] of Object.entries(needs)) {
    if ((inv.items.get(id as ItemId) ?? 0) < (qty ?? 0)) return false
  }
  return true
}

// ─── Movement ─────────────────────────────────────────────────────────────────
export interface MovementComponent {
  vx: number
  vy: number
  speed: number
  facing: 'up' | 'down' | 'left' | 'right'
}

export function makeMovement(speed: number): MovementComponent {
  return { vx: 0, vy: 0, speed, facing: 'down' }
}

// ─── Combat ───────────────────────────────────────────────────────────────────
export interface CombatComponent {
  damage: number
  attackCooldownMs: number  // ms remaining before next attack
  knockbackForce: number
  isAttacking: boolean
  attackAngle: number        // radians — direction of swing
}

export function makeCombat(damage = 1, knockback = 80): CombatComponent {
  return { damage, attackCooldownMs: 0, knockbackForce: knockback, isAttacking: false, attackAngle: 0 }
}

// ─── AI / NPC ─────────────────────────────────────────────────────────────────
export type AIBehaviour = 'wander' | 'follow_player' | 'flee_player' | 'idle'

export interface AIComponent {
  behaviour: AIBehaviour
  wanderTimer: number      // ms until next direction change
  wanderDirX: number
  wanderDirY: number
  aggroRange: number       // pixels — distance at which aggressive NPCs switch mode
}

// ─── Item pickup ──────────────────────────────────────────────────────────────
export interface ItemEntityComponent {
  itemId: ItemId
  count: number
  lifetimeMs: number   // auto-despawn after this many ms (0 = never)
}

// ─── Chest storage ────────────────────────────────────────────────────────────
export interface StorageComponent {
  items: Map<ItemId, number>
  capacity: number
}

// ─── Light emitter ────────────────────────────────────────────────────────────
export interface LightComponent {
  radius: number    // pixels
  intensity: number // 0-1
  r: number; g: number; b: number
}

// ─── House marker (set on BENCH area during detection) ───────────────────────
export interface HouseMarkerComponent {
  tokenId: number | null    // null = not yet minted
  quality: number           // 1-5
  damaged: boolean
  tileX: number             // top-left tile of detected house rect
  tileY: number
  widthTiles: number
  heightTiles: number
}

// ─── Entity collider ──────────────────────────────────────────────────────────
export interface ColliderComponent {
  halfW: number   // half-width pixels from centre
  halfH: number   // half-height pixels from centre
}
