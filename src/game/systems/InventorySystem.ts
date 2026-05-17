import type { EntityManager } from '../entities/Entity'
import { dist } from './MovementSystem'

export class InventorySystem {
  /**
   * Each frame:
   * • Decay drop lifetimes (0 = permanent ground item, never despawns)
   * • Auto-pickup XP orbs (they're ephemeral rewards, not items to manage)
   */
  update(em: EntityManager, playerId: number, dt = 0): void {
    // ── Lifetime decay for temporary drops ───────────────────────────────────
    for (const entity of em.ofType('ITEM_ENTITY')) {
      const ie = entity.components.itemEntity
      if (!ie) continue
      if (ie.lifetimeMs === 0) continue   // 0 = permanent (world-gen item)
      ie.lifetimeMs -= dt
      if (ie.lifetimeMs <= 0) entity.active = false
    }

    // ── Auto-pickup XP orbs ──────────────────────────────────────────────────
    const player = em.get(playerId)
    if (!player?.components.inventory) return
    for (const entity of em.ofType('ITEM_ENTITY')) {
      if (entity.type !== 'XP_ORB') continue
      if (dist(player.x, player.y, entity.x, entity.y) <= 20) {
        const xp = player.components.experience
        if (xp) xp.xp += 5
        entity.active = false
      }
    }
  }
}
