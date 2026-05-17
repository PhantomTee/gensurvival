import Phaser from 'phaser'
import { Entity, type EntityManager } from '../Entity'
import { makeHealth } from '../../components'

export function createBench(scene: Phaser.Scene, tx: number, ty: number, em: EntityManager): Entity {
  const px = tx * 16 + 8
  const py = ty * 16 + 8
  const sprite = scene.add.sprite(px, py, 'bench').setDepth(3)
  const e = new Entity('BENCH', sprite)
  e.components.health   = makeHealth(6)
  e.components.collider = { halfW: 8, halfH: 6 }
  em.add(e)
  return e
}
