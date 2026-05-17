import type { EntityManager } from '../entities/Entity'
import { HealthSystem } from './HealthSystem'
import { applyKnockback } from './MovementSystem'
import { ATTACK_COOLDOWN, KNOCKBACK_FORCE } from '../constants'

export class CombatSystem {
  update(em: EntityManager, dt: number): void {
    for (const entity of em.all()) {
      const cb = entity.components.combat
      if (!cb) continue
      if (cb.attackCooldownMs > 0) {
        cb.attackCooldownMs = Math.max(0, cb.attackCooldownMs - dt)
      }
    }
  }

  /**
   * Execute a melee attack from attacker against all entities within reach.
   * reach: pixel radius of the attack arc
   * arc: half-angle in radians of attack cone (Math.PI = 180° sweep)
   */
  static attack(
    em: EntityManager,
    attackerId: number,
    damage: number,
    reach = 18,
    arc = Math.PI * 0.75,
    skipTypes?: Set<string>,
  ): boolean {
    const attacker = em.get(attackerId)
    if (!attacker?.components.combat) return false
    const cb = attacker.components.combat
    if (cb.attackCooldownMs > 0) return false

    cb.attackCooldownMs = ATTACK_COOLDOWN
    cb.isAttacking = true

    let hit = false
    for (const target of em.all()) {
      if (target.id === attackerId) continue
      if (!target.components.health) continue
      if (skipTypes?.has(target.type)) continue   // tool-gated targets

      const dx = target.x - attacker.x
      const dy = target.y - attacker.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > reach) continue

      // Check arc
      const angle = Math.atan2(dy, dx)
      const diff = Math.abs(Phaser.Math.Angle.Wrap(angle - cb.attackAngle))
      if (diff > arc) continue

      if (HealthSystem.damage(em, target.id, damage)) {
        applyKnockback(em, target.id, angle, KNOCKBACK_FORCE)
        hit = true
      }
    }

    return hit
  }
}

// Need Phaser in scope for Phaser.Math.Angle.Wrap
import Phaser from 'phaser'
