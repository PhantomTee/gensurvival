import Phaser from 'phaser'
import { Entity, type EntityManager } from '../Entity'

export function createLantern(scene: Phaser.Scene, tx: number, ty: number, em: EntityManager): Entity {
  const px = tx * 16 + 8
  const py = ty * 16 + 8
  const sprite = scene.add.sprite(px, py, 'lantern').setDepth(2)
  sprite.setTint(0xffee88)

  const e = new Entity('LANTERN', sprite)
  e.components.health = { value: 4, max: 4, regenCooldownMs: 0, invincibleMs: 0 }
  e.components.light  = { radius: 96, intensity: 1.0, r: 255, g: 220, b: 120 }
  em.add(e)
  return e
}
