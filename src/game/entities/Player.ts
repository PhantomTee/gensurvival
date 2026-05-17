import Phaser from 'phaser'
import { Entity } from './Entity'
import {
  makeHealth, makeEnergy, makeMovement, makeCombat, makeInventory,
} from '../components'
import {
  PLAYER_MAX_HEALTH, PLAYER_MAX_ENERGY,
  MAX_SPEED, PLAYER_INVENTORY_SLOTS,
} from '../constants'
import type { EntityManager } from './Entity'

export function createPlayer(scene: Phaser.Scene, x: number, y: number, em: EntityManager): Entity {
  const sprite = scene.add.sprite(x, y, 'player', 1)
  sprite.setDepth(5)
  sprite.play('player_idle')

  const player = new Entity('PLAYER', sprite)
  player.components.health      = makeHealth(PLAYER_MAX_HEALTH)
  player.components.energy      = makeEnergy(PLAYER_MAX_ENERGY)
  player.components.experience  = { xp: 0 }
  player.components.inventory   = makeInventory(PLAYER_INVENTORY_SLOTS)
  player.components.movement    = makeMovement(MAX_SPEED)
  player.components.combat      = makeCombat(1.0, 80)

  em.add(player)
  return player
}

/**
 * Handle WASD / arrow input and keep facing + attack-angle in sync.
 * Attack is fired by WorldScene (which has full inventory/entity context).
 */
export function handlePlayerInput(
  cursors: Phaser.Types.Input.Keyboard.CursorKeys,
  wasd: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key },
  player: Entity,
): void {
  const mv = player.components.movement!
  const cb = player.components.combat!

  let vx = 0, vy = 0
  if (cursors.left.isDown  || wasd.left.isDown)  vx -= 1
  if (cursors.right.isDown || wasd.right.isDown) vx += 1
  if (cursors.up.isDown    || wasd.up.isDown)    vy -= 1
  if (cursors.down.isDown  || wasd.down.isDown)  vy += 1

  mv.vx = vx
  mv.vy = vy

  // Keep attack angle in sync with facing so combat arc is always correct
  const angles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }
  cb.attackAngle = angles[mv.facing]

}
