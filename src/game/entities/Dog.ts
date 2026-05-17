import Phaser from 'phaser'
import { Entity, type EntityManager } from './Entity'
import { makeHealth, makeMovement } from '../components'

export function createDog(scene: Phaser.Scene, x: number, y: number, em: EntityManager): Entity {
  const sprite = scene.add.sprite(x, y, 'dog', 1).setDepth(4)
  sprite.play('dog_idle')

  const e = new Entity('DOG', sprite)
  e.components.health   = makeHealth(2)
  e.components.movement = makeMovement(40)
  e.components.ai       = {
    behaviour:   'wander',
    wanderTimer: 0,
    wanderDirX:  0,
    wanderDirY:  0,
    aggroRange:  0,
  }
  em.add(e)
  return e
}
