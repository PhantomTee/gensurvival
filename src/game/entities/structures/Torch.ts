import Phaser from 'phaser'
import { Entity, type EntityManager } from '../Entity'

export function createTorch(scene: Phaser.Scene, tx: number, ty: number, em: EntityManager): Entity {
  const px = tx * 16 + 8
  const py = ty * 16 + 8
  const sprite = scene.add.sprite(px, py, 'torch').setDepth(2)
  sprite.setTint(0xffdd44)

  const e = new Entity('TORCH', sprite)
  e.components.health = { value: 2, max: 2, regenCooldownMs: 0, invincibleMs: 0 }
  e.components.light  = { radius: 64, intensity: 0.8, r: 255, g: 200, b: 80 }
  em.add(e)
  return e
}
