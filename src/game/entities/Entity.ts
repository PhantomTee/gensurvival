import Phaser from 'phaser'
import type { EntityType } from '../registry/ENTITIES'
import type {
  HealthComponent, EnergyComponent, ExperienceComponent,
  InventoryComponent, MovementComponent, CombatComponent,
  AIComponent, ItemEntityComponent, StorageComponent,
  LightComponent, HouseMarkerComponent, ColliderComponent,
} from '../components'

export interface EntityComponents {
  health?: HealthComponent
  energy?: EnergyComponent
  experience?: ExperienceComponent
  inventory?: InventoryComponent
  movement?: MovementComponent
  combat?: CombatComponent
  ai?: AIComponent
  itemEntity?: ItemEntityComponent
  storage?: StorageComponent
  light?: LightComponent
  house?: HouseMarkerComponent
  collider?: ColliderComponent
}

let _nextId = 1
function nextId(): number { return _nextId++ }

/**
 * Base game entity — wraps a Phaser.GameObjects.Sprite and holds ECS components.
 * All logic lives in Systems; this class is pure data + sprite lifecycle.
 */
export class Entity {
  readonly id: number
  readonly type: EntityType
  sprite: Phaser.GameObjects.Sprite
  components: EntityComponents = {}
  active = true

  constructor(type: EntityType, sprite: Phaser.GameObjects.Sprite) {
    this.id = nextId()
    this.type = type
    this.sprite = sprite
  }

  get x(): number { return this.sprite.x }
  get y(): number { return this.sprite.y }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y)
  }

  destroy(): void {
    this.active = false
    this.sprite.destroy()
  }
}

/** Central registry of all live entities in the current scene */
export class EntityManager {
  private entities: Map<number, Entity> = new Map()

  add(e: Entity): void {
    this.entities.set(e.id, e)
  }

  remove(id: number): void {
    const e = this.entities.get(id)
    if (e) { e.destroy(); this.entities.delete(id) }
  }

  get(id: number): Entity | undefined {
    return this.entities.get(id)
  }

  all(): Entity[] {
    return [...this.entities.values()].filter(e => e.active)
  }

  /** All entities including those marked inactive (just-killed, pre-cleanup) */
  allRaw(): Entity[] {
    return [...this.entities.values()]
  }

  ofType(type: EntityType): Entity[] {
    return this.all().filter(e => e.type === type)
  }

  clear(): void {
    this.entities.forEach(e => e.destroy())
    this.entities.clear()
  }

  /** Prune entities that have been marked inactive and destroy their sprites */
  cleanup(): void {
    for (const [id, e] of this.entities) {
      if (!e.active) {
        // Destroy the Phaser sprite if it is still in the scene display list.
        // Setting entity.active = false alone does NOT remove the sprite;
        // entity.destroy() does both, but some code paths only set active directly.
        if (e.sprite && e.sprite.scene) e.sprite.destroy()
        this.entities.delete(id)
      }
    }
  }
}
