import type { EntityManager } from '../entities/Entity'
import { PLAYER_HEALTH_REGEN_COOLDOWN } from '../constants'

export class HealthSystem {
  update(em: EntityManager, dt: number): void {
    for (const entity of em.all()) {
      const h = entity.components.health
      if (!h) continue

      // Count down i-frames
      if (h.invincibleMs > 0) {
        h.invincibleMs = Math.max(0, h.invincibleMs - dt)
      }

      // Natural regen (player only — others don't regen)
      if (entity.type === 'PLAYER') {
        h.regenCooldownMs -= dt
        if (h.regenCooldownMs <= 0 && h.value < h.max) {
          h.value = Math.min(h.max, h.value + 0.5)
          h.regenCooldownMs = PLAYER_HEALTH_REGEN_COOLDOWN
        }
      }

      // Die if health hits 0
      if (h.value <= 0 && entity.type !== 'PLAYER') {
        entity.active = false
      }
    }
  }

  /**
   * Apply damage to an entity. Respects i-frames.
   * Returns true if damage was actually applied.
   */
  static damage(em: EntityManager, entityId: number, amount: number): boolean {
    const e = em.get(entityId)
    if (!e?.components.health) return false
    const h = e.components.health
    if (h.invincibleMs > 0) return false
    h.value = Math.max(0, h.value - amount)
    h.invincibleMs = 400   // 400ms i-frames
    return true
  }

  static heal(em: EntityManager, entityId: number, amount: number): void {
    const e = em.get(entityId)
    if (!e?.components.health) return
    const h = e.components.health
    h.value = Math.min(h.max, h.value + amount)
  }
}
