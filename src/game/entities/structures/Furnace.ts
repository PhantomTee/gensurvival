import Phaser from 'phaser'
import { Entity, type EntityManager } from '../Entity'
import { makeHealth } from '../../components'

export function createFurnace(scene: Phaser.Scene, tx: number, ty: number, em: EntityManager): Entity {
  const px = tx * 16 + 8
  const py = ty * 16 + 8
  const sprite = scene.add.sprite(px, py, 'furnace').setDepth(3)

  const e = new Entity('FURNACE', sprite)
  e.components.health   = makeHealth(8)
  e.components.collider = { halfW: 8, halfH: 7 }
  em.add(e)
  return e
}
