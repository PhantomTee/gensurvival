import Phaser from 'phaser'
import type { EntityManager } from '../entities/Entity'
import type { TileMapManager } from '../world/TileMapManager'
import { TILE_SIZE } from '../constants'

export class MovementSystem {
  update(em: EntityManager, tm: TileMapManager, dt: number): void {
    const dtSec = dt / 1000

    // Cache solid entities once per frame
    const solidEntities = em.all().filter(e => e.components.collider != null)

    for (const entity of em.all()) {
      const mv = entity.components.movement
      if (!mv || (mv.vx === 0 && mv.vy === 0)) continue

      // Normalise diagonal movement
      const len = Math.sqrt(mv.vx * mv.vx + mv.vy * mv.vy)
      const nx = (mv.vx / len) * mv.speed * dtSec
      const ny = (mv.vy / len) * mv.speed * dtSec

      // Update facing direction
      if (Math.abs(mv.vx) > Math.abs(mv.vy)) {
        mv.facing = mv.vx > 0 ? 'right' : 'left'
      } else {
        mv.facing = mv.vy > 0 ? 'down' : 'up'
      }

      // Separate X / Y collision resolution (AABB vs solid tiles + solid entities)
      const halfW = 4
      const halfH = 4

      // ── Try X ─────────────────────────────────────────────────────────────
      const newX = entity.x + nx
      if (!this.solidAt(tm, newX - halfW, entity.y - halfH) &&
          !this.solidAt(tm, newX + halfW, entity.y - halfH) &&
          !this.solidAt(tm, newX - halfW, entity.y + halfH) &&
          !this.solidAt(tm, newX + halfW, entity.y + halfH) &&
          !this.hitsEntity(solidEntities, entity.id, newX, entity.y, halfW, halfH)) {
        entity.sprite.x = newX
      }

      // ── Try Y ─────────────────────────────────────────────────────────────
      const newY = entity.y + ny
      if (!this.solidAt(tm, entity.x - halfW, newY - halfH) &&
          !this.solidAt(tm, entity.x + halfW, newY - halfH) &&
          !this.solidAt(tm, entity.x - halfW, newY + halfH) &&
          !this.solidAt(tm, entity.x + halfW, newY + halfH) &&
          !this.hitsEntity(solidEntities, entity.id, entity.x, newY, halfW, halfH)) {
        entity.sprite.y = newY
      }
    }
  }

  private solidAt(tm: TileMapManager, px: number, py: number): boolean {
    const tx = Math.floor(px / TILE_SIZE)
    const ty = Math.floor(py / TILE_SIZE)
    return tm.isSolid(tx, ty)
  }

  private hitsEntity(
    solids: import('../entities/Entity').Entity[],
    selfId: number,
    x: number, y: number, hw: number, hh: number,
  ): boolean {
    for (const other of solids) {
      if (other.id === selfId) continue
      if (!other.active) continue
      const col = other.components.collider!
      if (Math.abs(x - other.x) < hw + col.halfW &&
          Math.abs(y - other.y) < hh + col.halfH) return true
    }
    return false
  }
}

/** Apply a one-shot knockback impulse */
export function applyKnockback(em: EntityManager, entityId: number, angle: number, force: number): void {
  const e = em.get(entityId)
  if (!e?.components.movement) return
  e.components.movement.vx += Math.cos(angle) * force
  e.components.movement.vy += Math.sin(angle) * force
}

/** Clamp velocity toward zero */
export function decayVelocity(mv: { vx: number; vy: number }, dt: number): void {
  const friction = 1 - Math.min(1, 10 * dt / 1000)
  mv.vx *= friction
  mv.vy *= friction
  if (Math.abs(mv.vx) < 0.1) mv.vx = 0
  if (Math.abs(mv.vy) < 0.1) mv.vy = 0
}

/** Utility: pixel distance */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Phaser.Math.Distance.Between(ax, ay, bx, by)
}
