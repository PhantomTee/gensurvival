import Phaser from 'phaser'
import { Entity, type EntityManager } from '../Entity'
import { HealthSystem } from '../../systems/HealthSystem'
import { TILE_SIZE } from '../../constants'
import type { TileMapManager } from '../../world/TileMapManager'

export function createTNT(scene: Phaser.Scene, tx: number, ty: number, em: EntityManager): Entity {
  const px = tx * TILE_SIZE + 8
  const py = ty * TILE_SIZE + 8
  const sprite = scene.add.sprite(px, py, 'tnt').setDepth(3)
  sprite.setTint(0xff3333)

  const e = new Entity('TNT', sprite)
  e.components.health = { value: 1, max: 1, regenCooldownMs: 0, invincibleMs: 0 }
  em.add(e)
  return e
}

/** Explode TNT — damages entities and breaks tiles in radius */
export function explodeTNT(
  tntId: number,
  em: EntityManager,
  tm: TileMapManager,
  scene: Phaser.Scene,
): void {
  const tnt = em.get(tntId)
  if (!tnt) return

  const cx = tnt.x, cy = tnt.y
  const blastRadius = 48   // pixels

  // Damage entities in range
  for (const e of em.all()) {
    if (e.id === tntId) continue
    const dx = e.x - cx, dy = e.y - cy
    if (Math.sqrt(dx * dx + dy * dy) <= blastRadius) {
      HealthSystem.damage(em, e.id, 2)
    }
  }

  // Break tiles in range
  const tr = Math.ceil(blastRadius / TILE_SIZE)
  const ctX = Math.floor(cx / TILE_SIZE)
  const ctY = Math.floor(cy / TILE_SIZE)
  for (let dy = -tr; dy <= tr; dy++) {
    for (let dx = -tr; dx <= tr; dx++) {
      if (Math.sqrt(dx * dx + dy * dy) <= tr) {
        tm.breakTile(ctX + dx, ctY + dy)
      }
    }
  }

  // Visual flash
  scene.cameras.main.shake(200, 0.01)
  em.remove(tntId)
}
