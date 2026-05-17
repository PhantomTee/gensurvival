import type { EntityManager, Entity } from '../entities/Entity'
import { CombatSystem } from './CombatSystem'
import { dist, decayVelocity } from './MovementSystem'

export class AISystem {
  update(em: EntityManager, dt: number, player: Entity | null): void {
    for (const entity of em.all()) {
      const ai = entity.components.ai
      const mv = entity.components.movement
      if (!ai || !mv) continue

      switch (ai.behaviour) {
        case 'wander':
          this.doWander(entity, dt)
          break
        case 'follow_player':
          if (player) this.doFollow(entity, player)
          else this.doWander(entity, dt)
          break
        case 'flee_player':
          if (player) this.doFlee(entity, player)
          else this.doWander(entity, dt)
          break
        case 'idle':
          mv.vx = 0; mv.vy = 0
          break
      }

      // Zombie attacks player on contact
      if (entity.type === 'ZOMBIE' && player) {
        const d = dist(entity.x, entity.y, player.x, player.y)
        if (d < 14) {
          const angle = Math.atan2(player.y - entity.y, player.x - entity.x)
          const cb = entity.components.combat
          if (cb) {
            cb.attackAngle = angle
            CombatSystem.attack(em, entity.id, cb.damage, 18)
          }
        }
        // Switch to follow when aggro range triggered
        if (d < ai.aggroRange) {
          ai.behaviour = 'follow_player'
        } else {
          ai.behaviour = 'wander'
        }
      }

      decayVelocity(mv, dt)
    }
  }

  private doWander(entity: Entity, dt: number): void {
    const ai = entity.components.ai!
    const mv = entity.components.movement!
    ai.wanderTimer -= dt
    if (ai.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2
      ai.wanderDirX = Math.cos(angle)
      ai.wanderDirY = Math.sin(angle)
      ai.wanderTimer = 1000 + Math.random() * 2000
    }
    mv.vx = ai.wanderDirX * mv.speed * 0.5
    mv.vy = ai.wanderDirY * mv.speed * 0.5
  }

  private doFollow(entity: Entity, player: Entity): void {
    const mv = entity.components.movement!
    const dx = player.x - entity.x
    const dy = player.y - entity.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 10) { mv.vx = 0; mv.vy = 0; return }
    mv.vx = (dx / d) * mv.speed
    mv.vy = (dy / d) * mv.speed
  }

  private doFlee(entity: Entity, player: Entity): void {
    const mv = entity.components.movement!
    const dx = entity.x - player.x
    const dy = entity.y - player.y
    const d = Math.sqrt(dx * dx + dy * dy)
    mv.vx = (dx / d) * mv.speed
    mv.vy = (dy / d) * mv.speed
  }
}
