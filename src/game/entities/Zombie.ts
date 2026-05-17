import Phaser from 'phaser'
import { Entity, type EntityManager } from './Entity'
import { makeHealth, makeMovement, makeCombat } from '../components'

export function createZombie(scene: Phaser.Scene, x: number, y: number, em: EntityManager): Entity {
  const sprite = scene.add.sprite(x, y, 'zombie', 1).setDepth(4)
  sprite.play('zombie_idle')

  const e = new Entity('ZOMBIE', sprite)
  e.components.health   = makeHealth(3)
  e.components.movement = makeMovement(28)
  e.components.combat   = makeCombat(0.5, 60)
  e.components.ai       = {
    behaviour:    'wander',
    wanderTimer:  0,
    wanderDirX:   0,
    wanderDirY:   0,
    aggroRange:   96,
  }
  em.add(e)
  return e
}
