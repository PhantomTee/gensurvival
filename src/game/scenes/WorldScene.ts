import Phaser from 'phaser'
import { WorldGenerator } from '../world/WorldGenerator'
import { ChunkManager } from '../world/ChunkManager'
import { TileMapManager } from '../world/TileMapManager'
import { EntityManager } from '../entities/Entity'
import { createPlayer } from '../entities/Player'
import { createZombie } from '../entities/Zombie'
import { createChicken } from '../entities/Chicken'
import { createDog } from '../entities/Dog'
import { createBench } from '../entities/structures/Bench'
import { createChest } from '../entities/structures/Chest'
import { createFurnace } from '../entities/structures/Furnace'
import { createTorch } from '../entities/structures/Torch'
import { HealthSystem } from '../systems/HealthSystem'
import { EnergySystem } from '../systems/EnergySystem'
import { MovementSystem } from '../systems/MovementSystem'
import { CombatSystem } from '../systems/CombatSystem'
import { AISystem } from '../systems/AISystem'
import { InventorySystem } from '../systems/InventorySystem'
import { makeDayNight, updateDayNight, type DayNightState } from '../systems/DayNightSystem'
import { TILE_SIZE, CHUNK_SIZE, DAY_STAGES } from '../constants'

/** Chunks around the player kept populated with world-gen entities. Must cover
 *  at least the rendered area (RENDER_RADIUS) or you see terrain with nothing on it. */
const ENTITY_SPAWN_RADIUS = 4
import { TILES, TILE_BY_INDEX } from '../registry/TILES'
import { addItem, removeItem } from '../components'
import { Entity } from '../entities/Entity'
import { useGameStore } from '../../ui/store'
import { dayNightStageName } from '../systems/DayNightSystem'
import { loadWorld, saveWorld } from '../../storage/WorldStorage'
import { loadPlayer, savePlayer } from '../../storage/PlayerLocalStorage'
import type { ItemId } from '../registry/ITEMS'
import { ITEMS } from '../registry/ITEMS'

interface TreeRespawn       { x: number; y: number; timerMs: number }
interface GroundItemRespawn { x: number; y: number; itemId: string; count: number; timerMs: number }

export class WorldScene extends Phaser.Scene {
  // World
  private generator!: WorldGenerator
  private chunks!: ChunkManager
  private tilemap!: TileMapManager

  // Entities
  private em!: EntityManager
  private player!: Entity
  private playerId = 0

  // Systems
  private healthSys  = new HealthSystem()
  private energySys  = new EnergySystem()
  private moveSys    = new MovementSystem()
  private combatSys  = new CombatSystem()
  private aiSys      = new AISystem()
  private invSys     = new InventorySystem()

  // Day/night
  private dayNight!: DayNightState
  private ambientOverlay!: Phaser.GameObjects.Rectangle

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key }
  private keyJ!: Phaser.Input.Keyboard.Key
  private keyF!: Phaser.Input.Keyboard.Key
  private keyK!: Phaser.Input.Keyboard.Key
  private keyESC!: Phaser.Input.Keyboard.Key

  // Auto-save
  private saveTimer = 0

  // Minimap
  private minimapGfx!: Phaser.GameObjects.Graphics
  private mapGfx!: Phaser.GameObjects.Graphics
  private mapLabel!: Phaser.GameObjects.Text
  private minimapTimer = 0
  private mapOpen = false
  private mapPanOffset = { x: 0, y: 0 }
  private mapPanThrottleMs = 0

  // Entity feedback
  private hpBarGfx!: Phaser.GameObjects.Graphics
  private hitTweenIds = new Set<number>()

  // Tree respawn queue
  private treeRespawnQueue: TreeRespawn[] = []
  // Ground item respawn queue — items picked up from the world respawn after 5 min
  private groundItemRespawnQueue: GroundItemRespawn[] = []

  // Pickup UI
  private pickupPrompt!: Phaser.GameObjects.Text

  // Hint system
  private hintCooldownMs = 0

  // Hunger / starvation
  private starvationDrainTimer = 0

  // Dog taming
  private tamedDogId: number | null = null
  /** Chunks whose world-gen entities have been spawned, so none spawn twice. */
  private spawnedChunks = new Set<string>()
  private lastEntityChunkX = Number.NaN
  private lastEntityChunkY = Number.NaN
  private lastEvictChunkX = Number.NaN
  private lastEvictChunkY = Number.NaN

  // E key for eating
  private keyE!: Phaser.Input.Keyboard.Key

  // Fishing
  private fishingCooldownMs = 0

  // Throttle — only push to React store at most every 100 ms
  private lastSyncMs = 0

  // TNT entities with fuse state
  private tntEntities: Map<number, { fuseMs: number; tx: number; ty: number }> = new Map()

  // Season tracking
  private seasonDayTracker = 0
  private currentSeason: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring'

  // Ranged projectiles
  private projectiles: Array<{
    sprite: Phaser.GameObjects.Rectangle
    vx: number; vy: number
    damage: number; range: number; traveled: number
    ownerId: number
  }> = []

  private houseMintRequestHandler: EventListener | null = null
  private textInputFocusHandler: EventListener | null = null
  private hydrateChainStateHandler: EventListener | null = null
  private chainMineConfirmedHandler: EventListener | null = null
  private chainPlaceConfirmedHandler: EventListener | null = null
  private fishResultHandler: EventListener | null = null
  private equipItemHandler: EventListener | null = null
  private setHotbarSlotHandler: EventListener | null = null
  private keyDownHandler: EventListener | null = null
  private keyUpHandler: EventListener | null = null
  private blurHandler: (() => void) | null = null
  private heldKeys = new Set<string>()
  private textInputFocused = false

  constructor() { super({ key: 'WorldScene' }) }

  create(): void {
    const store = useGameStore.getState()
    const seed  = store.worldSeed

    // ── World generation ─────────────────────────────────────────
    this.generator = new WorldGenerator(seed)
    this.chunks    = new ChunkManager(this.generator)
    this.tilemap   = new TileMapManager(this, this.chunks)
    this.em        = new EntityManager()

    // Pre-generate a ring of chunks around spawn, then move to a clear patch.
    const roughSpawn = this.generator.findSpawn()
    const roughTX = Math.floor(roughSpawn.x / TILE_SIZE)
    const roughTY = Math.floor(roughSpawn.y / TILE_SIZE)
    const roughSpawnCX = Math.floor(roughSpawn.x / (CHUNK_SIZE * TILE_SIZE))
    const roughSpawnCY = Math.floor(roughSpawn.y / (CHUNK_SIZE * TILE_SIZE))
    this.chunks.preload(roughSpawnCX, roughSpawnCY, 3)

    // ── Restore saved world tiles ─────────────────────────────────
    // Restore BEFORE picking a spawn: saved chunks overwrite generated tiles,
    // so a spawn chosen first could be searched against terrain that no longer
    // exists by the time the player stands on it.
    const savedWorld = loadWorld(store.walletAddress)
    if (savedWorld) this.chunks.restore(savedWorld.chunks)

    const spawn = this.findClearSpawnNear(roughTX, roughTY)

    // ── Player ───────────────────────────────────────────────────
    const savedPlayer = savedWorld ? loadPlayer(store.walletAddress) : null
    const savedTileX = savedPlayer ? Math.floor(savedPlayer.x / TILE_SIZE) : 0
    const savedTileY = savedPlayer ? Math.floor(savedPlayer.y / TILE_SIZE) : 0
    const savedIsClear = savedPlayer ? this.isClearSpawnTile(savedTileX, savedTileY) : false
    let px = savedPlayer && savedIsClear ? savedPlayer.x : spawn.x
    let py = savedPlayer && savedIsClear ? savedPlayer.y : spawn.y

    // Last line of defence: never start the player inside solid tiles. Every
    // path above is meant to guarantee this, but being wedged with no way to
    // move is unrecoverable for the player, so verify rather than assume.
    if (!this.isClearSpawnTile(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE))) {
      const rescued = this.findClearSpawnNear(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE))
      px = rescued.x
      py = rescued.y
    }

    this.player   = createPlayer(this, px, py, this.em)
    this.playerId = this.player.id

    // Restore player stats from save
    if (savedPlayer) {
      const h   = this.player.components.health!
      const en  = this.player.components.energy!
      const xp  = this.player.components.experience!
      const inv = this.player.components.inventory!
      h.value  = savedPlayer.health
      en.value = savedPlayer.energy
      xp.xp    = savedPlayer.xp
      for (const [id, count] of Object.entries(savedPlayer.inventory)) {
        addItem(inv, id as ItemId, count)
      }
      inv.hotbar = savedPlayer.hotbar
    }

    // ── Spawn entities from chunk data ───────────────────────────
    const playerCX = Math.floor(px / (CHUNK_SIZE * TILE_SIZE))
    const playerCY = Math.floor(py / (CHUNK_SIZE * TILE_SIZE))
    this.chunks.preload(playerCX, playerCY, 3)
    this.spawnChunkEntities(playerCX, playerCY, ENTITY_SPAWN_RADIUS)

    // ── Camera ───────────────────────────────────────────────────
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1)
    // Zoom 2 rather than 3: a 16 px tile lands on 32 screen px, showing about
    // 2.25x more of the world without touching any art.
    this.cameras.main.setZoom(2)

    // ── Day / Night overlay ──────────────────────────────────────
    // makeDayNight() syncs to real UTC+1 clock — never override totalElapsedMs
    this.dayNight = makeDayNight()
    if (savedWorld) this.dayNight.dayNumber = savedWorld.dayNumber
    const { width, height } = this.scale
    this.ambientOverlay = this.add
      .rectangle(0, 0, width * 10, height * 10, 0x000033, 0)
      .setScrollFactor(0)
      .setDepth(50)
      .setOrigin(0, 0)

    // ── Input ────────────────────────────────────────────────────
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd    = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
    this.keyJ   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J)
    this.keyF   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F)
    this.keyK   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K)
    this.keyE   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.keyESC = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

    this.keyDownHandler = ((e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return
      if (e.key.toLowerCase() === 'm' && !e.repeat) this.toggleMap()
      // Keys 1–5 switch hotbar slot
      const slotKey = parseInt(e.key)
      if (!e.repeat && slotKey >= 1 && slotKey <= 5) {
        this.player.components.inventory!.hotbarIndex = slotKey - 1
      }
      this.heldKeys.add(e.key.toLowerCase())
    }) as EventListener
    this.keyUpHandler = ((e: KeyboardEvent) => {
      this.heldKeys.delete(e.key.toLowerCase())
    }) as EventListener
    window.addEventListener('keydown', this.keyDownHandler)
    window.addEventListener('keyup', this.keyUpHandler)

    // Clear all held keys when window loses focus — prevents stuck movement
    this.blurHandler = () => { this.heldKeys.clear() }
    window.addEventListener('blur', this.blurHandler)

    // ── Right-click to place tile items ──────────────────────────
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.rightButtonDown()) this.handleRightClick(ptr)
    })

    // ── House mint request from CraftingPanel ────────────────────
    this.houseMintRequestHandler = ((e: CustomEvent) => {
      const inventory = e.detail as Record<string, number>
      useGameStore.getState().promptHouseMint({
        tileX:      Math.floor(this.player.x / TILE_SIZE),
        tileY:      Math.floor(this.player.y / TILE_SIZE),
        widthTiles:  5,
        heightTiles: 5,
        inventory,
      })
    }) as EventListener
    window.addEventListener('gensurvival:requestHouseMint', this.houseMintRequestHandler)

    this.textInputFocusHandler = ((e: CustomEvent) => {
      this.textInputFocused = Boolean(e.detail)
      if (this.textInputFocused) this.heldKeys.clear()
    }) as EventListener
    window.addEventListener('gensurvival:textInputFocus', this.textInputFocusHandler)

    this.hydrateChainStateHandler = ((e: CustomEvent) => {
      const state = e.detail as { inventory?: Record<string, number>; xp?: number; days_survived?: number }
      const inv = this.player.components.inventory!
      inv.items.clear()
      for (const [id, count] of Object.entries(state.inventory ?? {})) {
        if (count > 0) addItem(inv, id as ItemId, count)
      }
      if (typeof state.xp === 'number') this.player.components.experience!.xp = state.xp
      this.syncReactStore()
      this.showHint('Inventory hydrated from chain', '#88ff88')
    }) as EventListener
    window.addEventListener('gensurvival:hydrateChainState', this.hydrateChainStateHandler)

    this.chainMineConfirmedHandler = ((e: CustomEvent) => {
      const { x, y } = e.detail as { x: number; y: number }
      this.tilemap.breakTile(x, y)
      this.showHint('Mined on-chain', '#88ff88')
    }) as EventListener
    window.addEventListener('gensurvival:chainMineConfirmed', this.chainMineConfirmedHandler)

    this.chainPlaceConfirmedHandler = ((e: CustomEvent) => {
      const { x, y, itemId } = e.detail as { x: number; y: number; itemId: ItemId }
      this.applyConfirmedPlacement(x, y, itemId)
    }) as EventListener
    window.addEventListener('gensurvival:chainPlaceConfirmed', this.chainPlaceConfirmedHandler)

    // ── Fish result listener ─────────────────────────────────────
    // Only shows the hint and adds the item — craftDelta is NOT dispatched for
    // fishing to avoid double-granting. The chain delta is the authoritative source;
    // fishResult data comes directly from delta.grant so it is already chain-verified.
    this.fishResultHandler = ((e: CustomEvent) => {
      const { itemId, count } = e.detail as { itemId: string; count: number }
      const inv = this.player.components.inventory!
      addItem(inv, itemId as ItemId, count)
      this.syncReactStore()
      this.showHint(`Caught ${count}x ${itemId.replace(/_/g, ' ')}!`, '#88ccff')
    }) as EventListener
    window.addEventListener('gensurvival:fishResult', this.fishResultHandler)

    // ── Equip item to active hotbar slot (from React inventory panel) ──
    this.equipItemHandler = ((e: CustomEvent) => {
      const { itemId } = e.detail as { itemId: string }
      const inv = this.player.components.inventory!
      if ((inv.items.get(itemId as ItemId) ?? 0) > 0) {
        inv.hotbar[inv.hotbarIndex] = itemId as ItemId
        this.syncReactStore()
        this.showHint(`Equipped ${itemId.replace(/_/g, ' ')}  [slot ${inv.hotbarIndex + 1}]`, '#f5c842')
      }
    }) as EventListener
    window.addEventListener('gensurvival:equipItem', this.equipItemHandler)

    // ── Set hotbar slot from React hotbar UI ──────────────────────
    this.setHotbarSlotHandler = ((e: CustomEvent) => {
      const { slot } = e.detail as { slot: number }
      this.player.components.inventory!.hotbarIndex = slot
    }) as EventListener
    window.addEventListener('gensurvival:setHotbarSlot', this.setHotbarSlotHandler)

    // ── Sync React store initial stats ───────────────────────────
    this.syncReactStore()

    // ── Minimap ──────────────────────────────────────────────────
    this.minimapGfx = this.add.graphics().setScrollFactor(0).setDepth(200)
    this.mapGfx = this.add.graphics().setScrollFactor(0).setDepth(260).setVisible(false)
    this.mapLabel = this.add.text(0, 0, '', {
      fontSize: '8px', fontFamily: 'monospace', color: '#f5c842',
    }).setScrollFactor(0).setDepth(261).setVisible(false)
    this.drawMinimap()

    // ── HP bar overlay (world-space) ─────────────────────────────
    this.hpBarGfx = this.add.graphics().setDepth(100)

    // ── Pickup prompt (world-space, moved each frame) ────────────
    this.pickupPrompt = this.add.text(0, 0, '[F]', {
      fontSize: '6px', color: '#ffe066', fontFamily: 'monospace',
      backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(300).setVisible(false)
  }

  // ─── Chunk entity spawning ─────────────────────────────────────────────────

  /**
   * Drop chunk data far from the player.
   *
   * ChunkManager.evict existed but was never called, so every chunk generated
   * in a session stayed in memory for the whole session.
   */
  private evictDistantChunks(): void {
    const cx = Math.floor(this.player.x / (CHUNK_SIZE * TILE_SIZE))
    const cy = Math.floor(this.player.y / (CHUNK_SIZE * TILE_SIZE))
    if (cx === this.lastEvictChunkX && cy === this.lastEvictChunkY) return
    this.lastEvictChunkX = cx
    this.lastEvictChunkY = cy
    // Keep well beyond what is rendered and entity-populated, so eviction can
    // never take a chunk that is about to be drawn.
    this.chunks.evict(cx, cy, ENTITY_SPAWN_RADIUS + 4)
  }

  /** Spawns entities for any chunk the player has come near but not yet loaded. */
  private streamChunkEntities(): void {
    const cx = Math.floor(this.player.x / (CHUNK_SIZE * TILE_SIZE))
    const cy = Math.floor(this.player.y / (CHUNK_SIZE * TILE_SIZE))
    if (cx === this.lastEntityChunkX && cy === this.lastEntityChunkY) return
    this.lastEntityChunkX = cx
    this.lastEntityChunkY = cy
    this.spawnChunkEntities(cx, cy, ENTITY_SPAWN_RADIUS)
  }


  private spawnChunkEntities(cxCentre: number, cyCentre: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = cxCentre + dx
        const cy = cyCentre + dy
        const chunkKey = `${cx},${cy}`
        if (this.spawnedChunks.has(chunkKey)) continue
        this.spawnedChunks.add(chunkKey)
        const chunk = this.chunks.getOrGenerate(cx, cy)
        for (const spawn of chunk.spawns) {
          const spx = spawn.tileX * TILE_SIZE + TILE_SIZE / 2
          const spy = spawn.tileY * TILE_SIZE + TILE_SIZE / 2
          switch (spawn.type) {
            case 'ZOMBIE': {
              // The shared era's danger_level is the whole point of a world
              // authored from the news — it has to be felt, not just displayed.
              // Level 1 halves zombie density, level 5 doubles it; the extra
              // spawns are offset so they never stack on the same tile.
              const danger = useGameStore.getState().worldEra?.danger_level ?? 2
              if (danger >= 2 || (spawn.tileX + spawn.tileY) % 2 === 0) {
                createZombie(this, spx, spy, this.em)
              }
              if (danger >= 4) createZombie(this, spx + TILE_SIZE, spy, this.em)
              if (danger >= 5) createZombie(this, spx, spy + TILE_SIZE, this.em)
              break
            }
            case 'CHICKEN': createChicken(this, spx, spy, this.em); break
            case 'DOG':     createDog(this, spx, spy, this.em); break

            case 'TREE': {
              // Sprite shifted 8 px up; collision box covers the trunk area.
              const s = this.add.sprite(spx, spy - 8, 'tree').setDepth(3)
              const treeEntity = new Entity('TREE', s)
              treeEntity.components.health   = { value: 5, max: 5, regenCooldownMs: 0, invincibleMs: 0 }
              treeEntity.components.collider = { halfW: 7, halfH: 14 }
              this.em.add(treeEntity)
              break
            }

            case 'ITEM': {
              // Ground-scattered resource — permanent (lifetimeMs: 0)
              const itemId = spawn.itemId as ItemId
              if (!itemId || !(itemId in ITEMS)) break
              const count = spawn.count ?? 1
              this.spawnItemDrop(itemId, spx, spy, count, true)
              break
            }
          }
        }
      }
    }
  }

  // ─── Main update loop ──────────────────────────────────────────────────────

  update(_time: number, dt: number): void {
    // ── Movement input ──────────────────────────────────────────────────────
    this.handlePlayerMovementInput()

    if (Phaser.Input.Keyboard.JustDown(this.keyESC)) {
      this.scene.pause()
      this.scene.launch('PauseScene')
    }

    // ── J key — attack + mine ────────────────────────────────────────────────
    if (Phaser.Input.Keyboard.JustDown(this.keyJ)) {
      this.handleAttack()
    }

    // ── K key — interact (bench / chest / furnace) ───────────────────────────
    if (Phaser.Input.Keyboard.JustDown(this.keyK)) {
      this.handleInteract()
    }

    // ── F key — manual item pickup ───────────────────────────────────────────
    if (Phaser.Input.Keyboard.JustDown(this.keyF)) {
      this.tryPickupNearby()
    }

    // ── E key — eat equipped food ────────────────────────────────────────────
    if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.tryEatEquipped()
    }

    // ── Systems ─────────────────────────────────────────────────────────────
    this.healthSys.update(this.em, dt)
    this.energySys.update(this.em, dt)
    this.moveSys.update(this.em, this.tilemap, dt)
    this.combatSys.update(this.em, dt)
    this.aiSys.update(this.em, dt, this.player)
    this.invSys.update(this.em, this.playerId, dt)

    // ── Death drops BEFORE cleanup ───────────────────────────────────────────
    this.checkDeathDrops()
    this.em.cleanup()

    // ── Stream entities into newly entered chunks ────────────────────────────
    // spawnChunkEntities used to run once in create(), so trees, chickens,
    // zombies and ground items existed only in the 7x7 chunks around spawn and
    // the rest of the world was permanently empty.
    this.streamChunkEntities()
    this.evictDistantChunks()

    // ── Tree respawn countdown ───────────────────────────────────────────────
    this.tickTreeRespawn(dt)

    // ── Ground item respawn (5 min after pickup) ─────────────────────────────
    this.tickGroundItemRespawn(dt)

    // ── Hint cooldown ────────────────────────────────────────────────────────
    this.hintCooldownMs = Math.max(0, this.hintCooldownMs - dt)
    this.mapPanThrottleMs = Math.max(0, this.mapPanThrottleMs - dt)

    // ── Visual feedback ──────────────────────────────────────────────────────
    this.updateEntityFeedback()
    this.drawHealthBars()
    this.updatePickupPrompt()

    // ── Creature animations ──────────────────────────────────────────────────
    this.updateCreatureAnims()

    // ── Minimap (refresh every 600 ms) ───────────────────────────────────────
    this.minimapTimer += dt
    if (this.minimapTimer > 600) {
      this.minimapTimer = 0
      this.drawMinimap()
      if (this.mapOpen) this.drawWorldMap()
    }

    // ── Tilemap ──────────────────────────────────────────────────────────────
    const cam = this.cameras.main
    this.tilemap.update(cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2)

    // ── Day / Night ──────────────────────────────────────────────────────────
    const { alpha, r, g, b } = updateDayNight(this.dayNight, dt)
    const hexColor = Phaser.Display.Color.GetColor(Math.floor(r), Math.floor(g), Math.floor(b))
    this.ambientOverlay.setFillStyle(hexColor, alpha)

    // ── Auto-save every 30 s ─────────────────────────────────────────────────
    this.saveTimer += dt
    if (this.saveTimer > 30_000) {
      this.saveTimer = 0
      this.doSave()
    }

    // ── Starvation: when energy < 0.5, health slowly drains ─────────────────
    const enComp = this.player.components.energy!
    if (enComp.value < 0.5) {
      this.starvationDrainTimer += dt
      if (this.starvationDrainTimer >= 1000) {
        this.starvationDrainTimer = 0
        const h = this.player.components.health!
        h.value = Math.max(0.1, h.value - 0.05)
      }
    } else {
      this.starvationDrainTimer = 0
    }

    // ── Season tracking (every 7 days: spring→summer→autumn→winter→repeat) ──
    if (this.dayNight.dayNumber !== this.seasonDayTracker) {
      this.seasonDayTracker = this.dayNight.dayNumber
      const seasonIndex = Math.floor(this.dayNight.dayNumber / 7) % 4
      this.currentSeason = (['spring', 'summer', 'autumn', 'winter'] as const)[seasonIndex]
    }
    // Season effects on energy regen
    const enComp2 = this.player.components.energy!
    if (this.currentSeason === 'summer' && enComp2.value < enComp2.max) {
      enComp2.value = Math.max(0, enComp2.value - 0.0002 * dt)  // extra drain in summer
    }

    // ── Night: boost zombie aggro range ─────────────────────────────────────
    if (dayNightStageName(this.dayNight) === 'night') {
      for (const zombie of this.em.ofType('ZOMBIE')) {
        const ai = zombie.components.ai!
        ai.aggroRange = 240
      }
    }

    // ── TNT fuse countdown ───────────────────────────────────────────────────
    for (const [id, tnt] of this.tntEntities) {
      if (tnt.fuseMs < 0) continue
      tnt.fuseMs -= dt
      if (tnt.fuseMs <= 0) {
        // Explode: break 3×3 tiles, damage nearby entities
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            this.tilemap.breakTile(tnt.tx + dx, tnt.ty + dy)
          }
        }
        // Damage nearby entities
        const cx = (tnt.tx + 0.5) * TILE_SIZE
        const cy = (tnt.ty + 0.5) * TILE_SIZE
        for (const e of this.em.all()) {
          const d = Math.hypot(e.x - cx, e.y - cy)
          if (d < 60 && e.components.health) {
            e.components.health.value = Math.max(0, e.components.health.value - 3)
          }
        }
        // Destroy the sprite
        const tntEnt = this.em.get(id)
        if (tntEnt) tntEnt.destroy()
        this.tntEntities.delete(id)
      }
    }

    // ── Projectiles ──────────────────────────────────────────────────────────
    this.updateProjectiles(dt)

    // ── Fishing cooldown ─────────────────────────────────────────────────────
    this.fishingCooldownMs = Math.max(0, this.fishingCooldownMs - dt)

    // ── Sync React store (throttled — 100 ms intervals to avoid 60fps re-renders) ─
    const nowMs = this.time.now
    if (nowMs - this.lastSyncMs >= 100) {
      this.lastSyncMs = nowMs
      this.syncReactStore()
    }
  }

  // ─── Combat (J key) ───────────────────────────────────────────────────────

  /**
   * Fire attack against nearby entities, then mine the facing tile.
   * Trees require a TOOL_AXE; rock tiles require a TOOL_PICK.
   */
  private handleAttack(): void {
    const inv        = this.player.components.inventory!
    const equippedId = inv.hotbar[inv.hotbarIndex]
    const itemDef    = equippedId ? ITEMS[equippedId] : null
    const isRanged   = itemDef?.tags.includes('RANGED') ?? false
    const hasAxe     = itemDef?.tags.includes('TOOL_AXE')  ?? false
    const hasPick    = itemDef?.tags.includes('TOOL_PICK') ?? false

    // ── Ranged attack (gun) ───────────────────────────────────────
    if (isRanged && itemDef?.gun) {
      const gun    = itemDef.gun
      const ammoId = gun.ammoId
      const ammo   = inv.items.get(ammoId) ?? 0
      if (ammo < 1) {
        this.showHint(`Out of ${ammoId.replace(/_/g,' ')}! Craft more at a bench.`, '#ff8888')
        return
      }
      removeItem(inv, ammoId, 1)
      this.fireProjectile(itemDef.damage ?? 1.5, gun.range, gun.projectileSpeed, gun.color)
      const en = this.player.components.energy!
      en.value = Math.max(0, en.value - 0.1)
      en.regenRate = 0.01
      return   // ranged weapons do NOT swing melee or mine tiles
    }

    // ── Melee attack ─────────────────────────────────────────────
    const dmg = itemDef?.damage ?? 0.5   // bare hands = 0.5 dmg

    // Warn if near tree but no axe
    if (!hasAxe) {
      for (const e of this.em.ofType('TREE')) {
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y)
        if (d < 32) { this.showHint('Equip an axe to chop trees!'); break }
      }
    }

    // Trees are axe-only
    const skipTypes = hasAxe ? undefined : new Set(['TREE'])
    CombatSystem.attack(this.em, this.player.id, dmg, 24, undefined, skipTypes)

    // Mining and combat cost energy
    const en = this.player.components.energy!
    en.value = Math.max(0, en.value - 0.15)
    en.regenRate = 0.01

    // Tile mining (pickaxe needed for hard tiles)
    this.tryBreakFacingTile(hasPick)
  }

  // ─── Ranged projectile fire ────────────────────────────────────────────────

  private fireProjectile(damage: number, range: number, speed: number, color: number): void {
    const mv = this.player.components.movement!
    const angles: Record<string, number> = {
      right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2,
    }
    const angle = angles[mv.facing]
    const startX = this.player.x + Math.cos(angle) * 10
    const startY = this.player.y + Math.sin(angle) * 10
    const sprite = this.add.rectangle(startX, startY, 5, 3, color).setDepth(12)
    // Store velocity as px/s (unit vector × speed)
    this.projectiles.push({
      sprite,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage, range, traveled: 0, ownerId: this.playerId,
    })
    // Muzzle flash
    this.cameras.main.shake(60, 0.004)
  }

  // ─── Projectile update (called each frame) ────────────────────────────────

  private updateProjectiles(dt: number): void {
    const dtSec = dt / 1000
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      // vx/vy are already in px/s, so movement per frame = v * dtSec
      const mx = p.vx * dtSec
      const my = p.vy * dtSec
      p.sprite.x += mx
      p.sprite.y += my
      p.traveled += Math.sqrt(mx * mx + my * my)

      // Collision check
      let hit = false
      for (const e of this.em.all()) {
        if (e.id === p.ownerId) continue
        if (!e.components.health) continue
        const d = Math.hypot(e.x - p.sprite.x, e.y - p.sprite.y)
        if (d < 12) {
          HealthSystem.damage(this.em, e.id, p.damage)
          hit = true
          // Bullet impact flash
          const flash = this.add.rectangle(p.sprite.x, p.sprite.y, 10, 10, 0xffffff).setDepth(15)
          this.tweens.add({ targets: flash, alpha: 0, scaleX: 3, scaleY: 3, duration: 120,
            onComplete: () => flash.destroy() })
          break
        }
      }

      if (hit || p.traveled >= p.range) {
        p.sprite.destroy()
        this.projectiles.splice(i, 1)
      }
    }
  }

  // ─── Tile mining ──────────────────────────────────────────────────────────

  private tryBreakFacingTile(hasPick: boolean): void {
    const mv  = this.player.components.movement!
    const offsets: Record<string, [number, number]> = {
      right: [TILE_SIZE, 0], left: [-TILE_SIZE, 0],
      down:  [0, TILE_SIZE], up:   [0, -TILE_SIZE],
    }
    const [ox, oy] = offsets[mv.facing]
    const tx = Math.floor((this.player.x + ox) / TILE_SIZE)
    const ty = Math.floor((this.player.y + oy) / TILE_SIZE)

    const tileId = TILE_BY_INDEX[this.chunks.getTileIndex(tx, ty)]
    if ((tileId === 'ROCK' || tileId === 'IRON_ORE' || tileId === 'COAL_ORE') && !hasPick) {
      this.showHint('Equip a pickaxe to mine rock!')
      return
    }

    if (tileId === 'ROCK' || tileId === 'IRON_ORE' || tileId === 'COAL_ORE') {
      if (!useGameStore.getState().walletAddress) {
        this.showHint('Connect wallet to mine on-chain')
        return
      }
      // Drain energy for on-chain mining dispatch
      const enMine = this.player.components.energy!
      enMine.value = Math.max(0, enMine.value - 0.30)
      window.dispatchEvent(new CustomEvent('gensurvival:mineTile', { detail: { x: tx, y: ty, terrainType: tileId } }))
      return
    }

    // Non-hard breakable tiles (WOOD_WALL, WOOD_FLOOR) — local break, player receives drop
    const drop = this.tilemap.breakTile(tx, ty)
    if (drop) {
      // Salvage is settled on-chain, which also clears the tile from
      // build_tiles — otherwise a broken wall still counted towards a house.
      window.dispatchEvent(new CustomEvent('gensurvival:breakBuildTile', { detail: { x: tx, y: ty } }))
      this.spawnItemDrop(drop as ItemId, tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2, 1, false)
      this.showHint(`+1 ${drop.replace(/_/g, ' ')}`, '#88ff88')
      // Drain energy for breaking soft tiles
      const enBreak = this.player.components.energy!
      enBreak.value = Math.max(0, enBreak.value - 0.20)
    }
  }

  // ─── Pickup (F key) ───────────────────────────────────────────────────────

  private tryPickupNearby(): void {
    const RANGE = 32

    // Dog taming: F near a dog while holding meat
    {
      const inv = this.player.components.inventory!
      const eq  = inv.hotbar[inv.hotbarIndex]
      const isMeat = eq === 'RAW_MEAT' || eq === 'COOKED_MEAT'
      if (isMeat && this.tamedDogId === null) {
        for (const dog of this.em.ofType('DOG')) {
          if (dog.id === this.tamedDogId) continue
          const d = Math.hypot(dog.x - this.player.x, dog.y - this.player.y)
          if (d < 40) {
            removeItem(inv, eq as ItemId, 1)
            this.tamedDogId = dog.id
            dog.components.ai!.behaviour = 'follow_player'
            this.showHint('Dog tamed! It will follow and protect you.', '#ffdd88')
            return
          }
        }
      }
    }

    // Chicken catching: F beside a chicken. Catching yields the same meat as
    // killing one, so it is a quieter alternative rather than a better one.
    {
      let nearestChicken: Entity | null = null
      let nearestDist = RANGE
      for (const chicken of this.em.ofType('CHICKEN')) {
        const d = Math.hypot(chicken.x - this.player.x, chicken.y - this.player.y)
        if (d < nearestDist) { nearestDist = d; nearestChicken = chicken }
      }
      if (nearestChicken) {
        // The contract verifies the chicken against the world hash and grants
        // the meat; granting locally would drift from the chain inventory that
        // crafting spends.
        const ctx = Math.floor(nearestChicken.x / TILE_SIZE)
        const cty = Math.floor(nearestChicken.y / TILE_SIZE)
        nearestChicken.destroy()
        window.dispatchEvent(new CustomEvent('gensurvival:catchChicken', { detail: { x: ctx, y: cty } }))
        this.showHint('Catching chicken...', '#ffdd88')
        return
      }
    }

    let closest: Entity | null = null
    let closestDist = RANGE

    for (const e of this.em.ofType('ITEM_ENTITY')) {
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y)
      if (d < closestDist) { closestDist = d; closest = e }
    }

    if (closest) {
      const ie = closest.components.itemEntity!
      const isPermanent = ie.lifetimeMs === 0   // world-gen ground item
      const inv = this.player.components.inventory!

      // Read position BEFORE destroying the sprite (sprite.x/y are unavailable after destroy)
      const rx = closest.x
      const ry = closest.y

      // The chain grants the item — it derives what lies here from the same
      // per-coordinate hash the world generator used.
      window.dispatchEvent(new CustomEvent('gensurvival:claimGroundItem', {
        detail: { x: Math.floor(rx / TILE_SIZE), y: Math.floor(ry / TILE_SIZE) },
      }))

      closest.destroy()

      if (isPermanent) {
        this.groundItemRespawnQueue.push({
          x: rx, y: ry,
          itemId: ie.itemId, count: ie.count,
          timerMs: 300_000,
        })
      }

      const label = ITEMS[ie.itemId as ItemId]?.displayName ?? ie.itemId.replace(/_/g, ' ')
      this.showHint(`+${ie.count} ${label}`, '#88ff88')
      this.syncReactStore()
    } else {
      this.showHint('Nothing nearby  (move closer)')
    }
  }

  /** Floating "[F]" prompt above nearest item when within range */
  private updatePickupPrompt(): void {
    const RANGE = 32
    let closest: Entity | null = null
    let closestDist = RANGE

    for (const e of this.em.ofType('ITEM_ENTITY')) {
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y)
      if (d < closestDist) { closestDist = d; closest = e }
    }

    if (closest) {
      this.pickupPrompt.setPosition(closest.x, closest.y - 10).setVisible(true)
    } else {
      this.pickupPrompt.setVisible(false)
    }
  }

  // ─── Eat equipped food (E key) ────────────────────────────────────────────

  private tryEatEquipped(): void {
    const inv = this.player.components.inventory!
    const equipped = inv.hotbar[inv.hotbarIndex]
    if (!equipped) { this.showHint('Nothing to eat'); return }
    const itemDef = ITEMS[equipped]
    if (!itemDef.tags.includes('FOOD')) { this.showHint('Not edible!'); return }
    if ((inv.items.get(equipped) ?? 0) < 1) { this.showHint('None left'); return }

    removeItem(inv, equipped, 1)
    const h  = this.player.components.health!
    const en = this.player.components.energy!

    en.value = Math.min(en.max, en.value + (itemDef.healEnergy ?? 2))
    h.value  = Math.min(h.max,  h.value  + (itemDef.healHealth ?? 0))

    // Raw meat: 20% food poisoning
    if (equipped === 'RAW_MEAT' && Math.random() < 0.2) {
      h.value = Math.max(0.1, h.value - 0.3)
      this.showHint('Food poisoning!', '#ff6666')
    } else {
      this.showHint(`Ate ${itemDef.displayName} +${itemDef.healEnergy ?? 2} energy`, '#88ff88')
    }
  }

  // ─── Hints ────────────────────────────────────────────────────────────────

  private showHint(msg: string, color = '#ffe066'): void {
    if (this.hintCooldownMs > 0) return
    this.hintCooldownMs = 1800
    const t = this.add.text(this.player.x, this.player.y - 18, msg, {
      fontSize: '7px', color, fontFamily: 'monospace',
      backgroundColor: '#00000099', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(350)
    this.tweens.add({
      targets: t, y: t.y - 22, alpha: 0, duration: 1600, ease: 'Power2',
      onComplete: () => t.destroy(),
    })
  }

  // ─── Interact (K key) ─────────────────────────────────────────────────────

  private handleInteract(): void {
    // Fishing: K near water tile with fishing rod equipped
    {
      const inv = this.player.components.inventory!
      const eq  = inv.hotbar[inv.hotbarIndex]
      if (eq === 'FISHING_ROD' && this.fishingCooldownMs <= 0) {
        const mv = this.player.components.movement!
        const offsets: Record<string, [number, number]> = {
          right:[TILE_SIZE,0], left:[-TILE_SIZE,0], down:[0,TILE_SIZE], up:[0,-TILE_SIZE],
        }
        const [ox, oy] = offsets[mv.facing]
        const ftx = Math.floor((this.player.x + ox) / TILE_SIZE)
        const fty = Math.floor((this.player.y + oy) / TILE_SIZE)
        const tid = TILE_BY_INDEX[this.chunks.getTileIndex(ftx, fty)]
        if (tid === 'WATER') {
          this.fishingCooldownMs = 8000
          if (!useGameStore.getState().walletAddress) {
            this.showHint('Connect wallet to fish on-chain')
            return
          }
          this.showHint('Casting line...', '#88ccff')
          window.dispatchEvent(new CustomEvent('gensurvival:fishAction', { detail: { x: ftx, y: fty } }))
          return
        }
      }
    }

    const range = 24
    for (const e of this.em.all()) {
      if (e.id === this.playerId) continue
      const dx = e.x - this.player.x
      const dy = e.y - this.player.y
      if (Math.sqrt(dx * dx + dy * dy) > range) continue

      if (e.type === 'BENCH') {
        const tx = Math.floor(e.x / TILE_SIZE)
        const ty = Math.floor(e.y / TILE_SIZE)
        useGameStore.getState().openCrafting('BENCH', e.id, tx, ty)
      } else if (e.type === 'CHEST') {
        useGameStore.getState().openChest(e.id)
      } else if (e.type === 'FURNACE') {
        const tx = Math.floor(e.x / TILE_SIZE)
        const ty = Math.floor(e.y / TILE_SIZE)
        useGameStore.getState().openCrafting('FURNACE', e.id, tx, ty)
      } else if (e.type === 'BED') {
        // Sleep: skip to morning, restore health + energy
        // Real-time day cycle — skip to next dawn (next cycle boundary)
        const cycleDurationMs = DAY_STAGES.reduce((s, st) => s + st.duration, 0)
        this.dayNight.totalElapsedMs = Math.ceil((this.dayNight.totalElapsedMs + 1) / cycleDurationMs) * cycleDurationMs
        const h = this.player.components.health!
        const en = this.player.components.energy!
        h.value = h.max
        en.value = en.max
        en.regenRate = 0.5
        this.showHint('You slept well. Health & energy restored!', '#88ccff')
      }
      break
    }
  }

  private handlePlayerMovementInput(): void {
    const mv = this.player.components.movement!
    const cb = this.player.components.combat!

    if (this.textInputFocused || document.activeElement?.tagName === 'INPUT') {
      mv.vx = 0
      mv.vy = 0
      this.heldKeys.clear()
      return
    }

    // When the world map is open, WASD pans the map view rather than moving the player
    if (this.mapOpen) {
      const left  = this.cursors.left.isDown  || this.wasd.left.isDown  || this.heldKeys.has('arrowleft')  || this.heldKeys.has('a')
      const right = this.cursors.right.isDown || this.wasd.right.isDown || this.heldKeys.has('arrowright') || this.heldKeys.has('d')
      const up    = this.cursors.up.isDown    || this.wasd.up.isDown    || this.heldKeys.has('arrowup')    || this.heldKeys.has('w')
      const down  = this.cursors.down.isDown  || this.wasd.down.isDown  || this.heldKeys.has('arrowdown')  || this.heldKeys.has('s')
      const panX  = (right ? 1 : 0) - (left ? 1 : 0)
      const panY  = (down  ? 1 : 0) - (up   ? 1 : 0)
      if (this.mapPanThrottleMs <= 0 && (panX !== 0 || panY !== 0)) {
        this.mapPanOffset.x += panX * 4
        this.mapPanOffset.y += panY * 4
        this.mapPanThrottleMs = 100   // pan 4 tiles per 100 ms ≈ 40 tiles/s
        this.drawWorldMap()
      }
      mv.vx = 0
      mv.vy = 0
      return
    }

    const left = this.cursors.left.isDown || this.wasd.left.isDown || this.heldKeys.has('arrowleft') || this.heldKeys.has('a')
    const right = this.cursors.right.isDown || this.wasd.right.isDown || this.heldKeys.has('arrowright') || this.heldKeys.has('d')
    const up = this.cursors.up.isDown || this.wasd.up.isDown || this.heldKeys.has('arrowup') || this.heldKeys.has('w')
    const down = this.cursors.down.isDown || this.wasd.down.isDown || this.heldKeys.has('arrowdown') || this.heldKeys.has('s')

    mv.vx = (right ? 1 : 0) - (left ? 1 : 0)
    mv.vy = (down ? 1 : 0) - (up ? 1 : 0)

    if (mv.vx !== 0 || mv.vy !== 0) {
      if (Math.abs(mv.vx) > Math.abs(mv.vy)) {
        mv.facing = mv.vx > 0 ? 'right' : 'left'
      } else {
        mv.facing = mv.vy > 0 ? 'down' : 'up'
      }
    }

    const angles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }
    cb.attackAngle = angles[mv.facing]
  }

  // ─── Entity death drops ────────────────────────────────────────────────────

  private checkDeathDrops(): void {
    for (const e of this.em.allRaw()) {
      const h = e.components.health
      if (!h || h.value > 0 || e.active !== false) continue

      switch (e.type) {
        case 'TREE':
          if (useGameStore.getState().walletAddress) {
            window.dispatchEvent(new CustomEvent('gensurvival:chopTree', {
              detail: {
                x: Math.floor(e.x / TILE_SIZE),
                y: Math.floor(e.y / TILE_SIZE),
              },
            }))
          } else {
            this.showHint('Connect wallet to chop trees on-chain')
          }
          // Queue respawn at the same position after 3 minutes
          this.treeRespawnQueue.push({ x: e.x, y: e.y, timerMs: 180_000 })
          break
        case 'ZOMBIE': {
          const roll = Math.random()
          if (roll < 0.05) this.spawnItemDrop('IRON_INGOT' as ItemId, e.x, e.y, 1, false)
          else if (roll < 0.15) this.spawnItemDrop('IRON_ORE' as ItemId, e.x, e.y, 1, false)
          else if (roll < 0.45) this.spawnItemDrop('COAL' as ItemId, e.x, e.y, 1, false)
          break
        }
        case 'CHICKEN':
          this.spawnItemDrop('RAW_MEAT' as ItemId, e.x, e.y, Math.random() < 0.7 ? 1 : 2, false)
          break
        case 'TNT': {
          const tntState = this.tntEntities.get(e.id)
          if (tntState && tntState.fuseMs < 0) {
            tntState.fuseMs = 3000  // 3 second fuse
            // Reset health so cleanup doesn't remove it before fuse fires
            if (e.components.health) e.components.health.value = 0.1
            e.active = true  // keep alive while fuse burns
            this.showHint('FUSE LIT - RUN!', '#ff4444')
          }
          break
        }
      }
    }
  }

  // ─── Tree respawn ──────────────────────────────────────────────────────────

  private tickTreeRespawn(dt: number): void {
    const ready: TreeRespawn[] = []
    const pending: TreeRespawn[] = []
    for (const entry of this.treeRespawnQueue) {
      entry.timerMs -= dt
      if (entry.timerMs <= 0) ready.push(entry)
      else pending.push(entry)
    }
    this.treeRespawnQueue = pending

    for (const entry of ready) {
      const s = this.add.sprite(entry.x, entry.y, 'tree').setDepth(3)
      const treeEntity = new Entity('TREE', s)
      treeEntity.components.health   = { value: 5, max: 5, regenCooldownMs: 0, invincibleMs: 0 }
      treeEntity.components.collider = { halfW: 7, halfH: 14 }
      this.em.add(treeEntity)
    }
  }

  // ─── Ground item respawn (5 min) ──────────────────────────────────────────

  private tickGroundItemRespawn(dt: number): void {
    const ready: GroundItemRespawn[]   = []
    const pending: GroundItemRespawn[] = []
    for (const entry of this.groundItemRespawnQueue) {
      entry.timerMs -= dt
      if (entry.timerMs <= 0) ready.push(entry)
      else pending.push(entry)
    }
    this.groundItemRespawnQueue = pending
    for (const entry of ready) {
      // Spawn at a random position within ±3 tiles of the original location
      // so the world feels alive rather than items always reappearing in the same spot
      const jx = Phaser.Math.Between(-3 * TILE_SIZE, 3 * TILE_SIZE)
      const jy = Phaser.Math.Between(-3 * TILE_SIZE, 3 * TILE_SIZE)
      this.spawnItemDrop(entry.itemId as ItemId, entry.x + jx, entry.y + jy, entry.count, true)
    }
  }

  // ─── Item drop helper ─────────────────────────────────────────────────────

  /**
   * @param permanent  true = lifetimeMs:0 (never despawns — world-gen item)
   *                   false = 45 s temporary drop
   */
  private spawnItemDrop(
    itemId: ItemId, x: number, y: number, count: number, permanent = false,
  ): void {
    const key    = `item_${itemId.toLowerCase()}`
    const texKey = this.textures.exists(key) ? key : 'item_wood_log'
    const jitter = permanent ? 0 : Phaser.Math.Between(-5, 5)
    const s = this.add.sprite(x + jitter, y + jitter, texKey)
      .setDepth(2)
      .setDisplaySize(10, 10)
    // Tint items that fell back to the wood-log texture so they are visually distinct
    if (texKey === 'item_wood_log' && key !== 'item_wood_log') {
      // Generate a stable color from the item id string
      let hash = 0
      for (let i = 0; i < key.length; i++) hash = (Math.imul(hash, 31) + key.charCodeAt(i)) >>> 0
      const tint = 0x808080 | ((hash & 0xff0000) | ((hash >> 8) & 0x00ff00) | ((hash >> 16) & 0x0000ff))
      s.setTint(tint >>> 0)
    }
    const drop = new Entity('ITEM_ENTITY', s)
    drop.components.itemEntity = { itemId, count, lifetimeMs: permanent ? 0 : 45_000 }
    this.em.add(drop)
  }

  // ─── Entity feedback (hit flash + shake) ──────────────────────────────────

  private updateEntityFeedback(): void {
    for (const e of this.em.all()) {
      const h = e.components.health
      if (!h) continue
      const sp = e.sprite as Phaser.GameObjects.Sprite

      if (h.invincibleMs > 0) {
        sp.setTint(h.invincibleMs > 200 ? 0xff6666 : 0xffffff)

        if (!this.hitTweenIds.has(e.id)) {
          this.hitTweenIds.add(e.id)
          this.tweens.add({
            targets: sp,
            angle: { from: -5, to: 5 },
            ease: 'Linear',
            duration: 60,
            yoyo: true,
            onComplete: () => {
              if (e.active) sp.setAngle(0)
              this.hitTweenIds.delete(e.id)
            },
          })
        }
      } else {
        sp.clearTint()
        sp.setAngle(0)
        this.hitTweenIds.delete(e.id)
      }
    }
  }

  // ─── HP bars ──────────────────────────────────────────────────────────────

  private drawHealthBars(): void {
    this.hpBarGfx.clear()
    const BAR_W = 14, BAR_H = 2, Y_OFF = 14
    for (const e of this.em.all()) {
      const h = e.components.health
      // Skip full-health entities and dead (≤0 HP) ones — no bar needed
      if (!h || h.value <= 0 || h.value >= h.max) continue
      const bx = e.x - BAR_W / 2
      const by = e.y - Y_OFF
      this.hpBarGfx.fillStyle(0x000000, 0.8)
      this.hpBarGfx.fillRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2)
      const pct = h.value / h.max
      const col = pct > 0.5 ? 0x44dd44 : pct > 0.25 ? 0xdddd00 : 0xdd3333
      this.hpBarGfx.fillStyle(col, 1)
      this.hpBarGfx.fillRect(bx, by, Math.max(1, BAR_W * pct), BAR_H)
    }
  }

  // ─── Creature walk/idle animations ────────────────────────────────────────

  private updateCreatureAnims(): void {
    const ANIM_KEYS = new Set(['PLAYER', 'ZOMBIE', 'CHICKEN', 'DOG'])
    for (const e of this.em.all()) {
      if (!ANIM_KEYS.has(e.type)) continue
      const mv = e.components.movement
      if (!mv) continue
      const typeKey = e.type.toLowerCase()
      const moving  = Math.abs(mv.vx) > 0.01 || Math.abs(mv.vy) > 0.01
      const animKey = moving ? `${typeKey}_walk_${mv.facing}` : `${typeKey}_idle`
      const sp      = e.sprite as Phaser.GameObjects.Sprite
      if (sp.anims.currentAnim?.key !== animKey) sp.play(animKey, true)
    }
  }

  // ─── Minimap ──────────────────────────────────────────────────────────────

  private drawMinimap(): void {
    const MAP = 50, CELL = 2, SIZE = MAP * CELL, PAD = 6
    const mx = this.scale.width  - SIZE - PAD
    const my = this.scale.height - SIZE - PAD

    this.minimapGfx.clear()
    this.minimapGfx.fillStyle(0x000000, 0.7)
    this.minimapGfx.fillRect(mx - 2, my - 2, SIZE + 4, SIZE + 4)

    const ctX  = Math.floor(this.player.x / TILE_SIZE)
    const ctY  = Math.floor(this.player.y / TILE_SIZE)
    const half = Math.floor(MAP / 2)

    for (let dy = 0; dy < MAP; dy++) {
      for (let dx = 0; dx < MAP; dx++) {
        const idx = this.chunks.getTileIndex(ctX - half + dx, ctY - half + dy)
        const tid = TILE_BY_INDEX[idx] ?? 'VOID'
        this.minimapGfx.fillStyle(TILES[tid].color, 1)
        this.minimapGfx.fillRect(mx + dx * CELL, my + dy * CELL, CELL, CELL)
      }
    }

    this.drawMapEntityMarkers(this.minimapGfx, mx, my, MAP, CELL, ctX, ctY, 2)

    // Player dot
    this.minimapGfx.fillStyle(0xffffff, 1)
    this.minimapGfx.fillRect(mx + half * CELL - 1, my + half * CELL - 1, 3, 3)

    this.minimapGfx.lineStyle(1, 0x888888, 0.8)
    this.minimapGfx.strokeRect(mx - 2, my - 2, SIZE + 4, SIZE + 4)
  }

  private toggleMap(): void {
    this.mapOpen = !this.mapOpen
    this.mapGfx.setVisible(this.mapOpen)
    this.mapLabel.setVisible(this.mapOpen)
    if (this.mapOpen) {
      this.mapPanOffset = { x: 0, y: 0 }   // reset pan to player position on open
      this.drawWorldMap()
    } else {
      this.mapGfx.clear()
    }
  }

  private drawWorldMap(): void {
    const MAP = 96
    const CELL = 4
    const SIZE = MAP * CELL
    const x0 = Math.floor((this.scale.width - SIZE) / 2)
    const y0 = Math.floor((this.scale.height - SIZE) / 2)
    const playerTileX = Math.floor(this.player.x / TILE_SIZE)
    const playerTileY = Math.floor(this.player.y / TILE_SIZE)
    // View centre respects the pan offset so WASD scrolls the map view
    const centerX = playerTileX + this.mapPanOffset.x
    const centerY = playerTileY + this.mapPanOffset.y
    const half = Math.floor(MAP / 2)

    this.mapGfx.clear()
    this.mapGfx.fillStyle(0x050505, 0.92)
    this.mapGfx.fillRect(x0 - 10, y0 - 28, SIZE + 20, SIZE + 42)
    this.mapGfx.lineStyle(2, 0xc8860a, 1)
    this.mapGfx.strokeRect(x0 - 10, y0 - 28, SIZE + 20, SIZE + 42)
    this.mapGfx.fillStyle(0xf5c842, 1)
    this.mapGfx.fillRect(x0, y0 - 18, 48, 2)

    for (let dy = 0; dy < MAP; dy++) {
      for (let dx = 0; dx < MAP; dx++) {
        const idx = this.chunks.getTileIndex(centerX - half + dx, centerY - half + dy)
        const tid = TILE_BY_INDEX[idx] ?? 'VOID'
        this.mapGfx.fillStyle(TILES[tid].color, 1)
        this.mapGfx.fillRect(x0 + dx * CELL, y0 + dy * CELL, CELL, CELL)
      }
    }

    this.drawMapEntityMarkers(this.mapGfx, x0, y0, MAP, CELL, centerX, centerY, 4)

    // Draw minted house rectangles on the map
    const houses = useGameStore.getState().houses
    for (const house of houses) {
      const hx = (house.tileX - centerX + half)
      const hy = (house.tileY - centerY + half)
      if (hx < 0 || hy < 0 || hx >= MAP || hy >= MAP) continue
      const col = house.damaged ? 0xff4444 : 0xf5c842
      this.mapGfx.lineStyle(1, col, 1)
      this.mapGfx.strokeRect(
        x0 + hx * CELL,
        y0 + hy * CELL,
        Math.min(house.widthTiles * CELL, (MAP - hx) * CELL),
        Math.min(house.heightTiles * CELL, (MAP - hy) * CELL),
      )
    }

    // Player dot position relative to the panned view
    const playerDotX = half - this.mapPanOffset.x
    const playerDotY = half - this.mapPanOffset.y
    if (playerDotX >= 0 && playerDotX < MAP && playerDotY >= 0 && playerDotY < MAP) {
      this.mapGfx.fillStyle(0xffffff, 1)
      this.mapGfx.fillRect(x0 + playerDotX * CELL - 3, y0 + playerDotY * CELL - 3, 7, 7)
      this.mapGfx.lineStyle(1, 0x000000, 1)
      this.mapGfx.strokeRect(x0 + playerDotX * CELL - 3, y0 + playerDotY * CELL - 3, 7, 7)
    }

    // Update floating label (title + pan hint)
    const panStr = (this.mapPanOffset.x !== 0 || this.mapPanOffset.y !== 0)
      ? `  (panned ${this.mapPanOffset.x > 0 ? '+' : ''}${this.mapPanOffset.x}, ${this.mapPanOffset.y > 0 ? '+' : ''}${this.mapPanOffset.y})`
      : ''
    this.mapLabel
      .setText(`WORLD MAP${panStr}   WASD: pan   M: close`)
      .setPosition(x0, y0 - 26)
  }

  private drawMapEntityMarkers(
    gfx: Phaser.GameObjects.Graphics,
    x0: number,
    y0: number,
    mapTiles: number,
    cell: number,
    centerTileX: number,
    centerTileY: number,
    size: number,
  ): void {
    const half = Math.floor(mapTiles / 2)
    const minTileX = centerTileX - half
    const minTileY = centerTileY - half

    for (const entity of this.em.all()) {
      if (entity.id === this.playerId) continue
      const tx = Math.floor(entity.x / TILE_SIZE)
      const ty = Math.floor(entity.y / TILE_SIZE)
      const mx = tx - minTileX
      const my = ty - minTileY
      if (mx < 0 || my < 0 || mx >= mapTiles || my >= mapTiles) continue

      const color = this.mapMarkerColor(entity)
      if (color == null) continue

      gfx.fillStyle(color, 1)
      gfx.fillRect(
        x0 + mx * cell + Math.max(0, Math.floor((cell - size) / 2)),
        y0 + my * cell + Math.max(0, Math.floor((cell - size) / 2)),
        size,
        size,
      )
    }
  }

  private mapMarkerColor(entity: Entity): number | null {
    if (entity.type === 'TREE') return 0x0f5f2a
    if (entity.type === 'ZOMBIE') return 0xd43c32
    if (entity.type === 'CHICKEN') return 0xffffff
    if (entity.type === 'DOG') return 0xc88a4a
    if (entity.type === 'BENCH' || entity.type === 'CHEST' || entity.type === 'FURNACE') return 0xf5c842
    if (entity.type === 'TORCH' || entity.type === 'LANTERN') return 0xffb000

    if (entity.type === 'ITEM_ENTITY') {
      const itemId = entity.components.itemEntity?.itemId
      if (itemId === 'WOOD_LOG') return 0x8b5a2b
      if (itemId === 'STONE') return 0xb0b0b0
      if (itemId === 'COAL') return 0x111111
      if (itemId === 'IRON_ORE') return 0xd7d7ff
      return 0xeeee88
    }

    return null
  }

  private findClearSpawnNear(tx: number, ty: number): { x: number; y: number } {
    for (let radius = 0; radius <= 80; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
          const candidateX = tx + dx
          const candidateY = ty + dy
          if (this.isClearSpawnTile(candidateX, candidateY)) {
            return {
              x: candidateX * TILE_SIZE + TILE_SIZE / 2,
              y: candidateY * TILE_SIZE + TILE_SIZE / 2,
            }
          }
        }
      }
    }

    return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 }
  }

  private isClearSpawnTile(tx: number, ty: number): boolean {
    for (let y = ty - 1; y <= ty + 1; y++) {
      for (let x = tx - 1; x <= tx + 1; x++) {
        const tileId = TILE_BY_INDEX[this.chunks.getTileIndex(x, y)] ?? 'VOID'
        if (TILES[tileId].solid) return false
      }
    }

    const cx = Math.floor(tx / CHUNK_SIZE)
    const cy = Math.floor(ty / CHUNK_SIZE)
    for (let chunkY = cy - 1; chunkY <= cy + 1; chunkY++) {
      for (let chunkX = cx - 1; chunkX <= cx + 1; chunkX++) {
        const chunk = this.chunks.getOrGenerate(chunkX, chunkY)
        for (const spawn of chunk.spawns) {
          const blocksSpawn = spawn.type === 'TREE'
          if (blocksSpawn && Math.abs(spawn.tileX - tx) <= 1 && Math.abs(spawn.tileY - ty) <= 1) {
            return false
          }
        }
      }
    }

    return true
  }

  // ─── Place tile / entity on right-click ───────────────────────────────────

  private handleRightClick(ptr: Phaser.Input.Pointer): void {
    const inv = this.player.components.inventory!
    const equipped = inv.hotbar[inv.hotbarIndex]
    if (!equipped) return

    const itemDef = ITEMS[equipped]
    const wx = this.cameras.main.scrollX + ptr.x / this.cameras.main.zoom
    const wy = this.cameras.main.scrollY + ptr.y / this.cameras.main.zoom
    const { tx, ty } = TileMapManager.pixelToTile(wx, wy)

    if (itemDef.placesTile || itemDef.placesEntity) {
      if (!useGameStore.getState().walletAddress) {
        this.showHint('Connect wallet to build on-chain')
        return
      }
      window.dispatchEvent(new CustomEvent('gensurvival:placeBuildTile', {
        detail: { x: tx, y: ty, itemId: equipped },
      }))
    }
  }

  private applyConfirmedPlacement(tx: number, ty: number, itemId: ItemId): void {
    const itemDef = ITEMS[itemId]
    if (itemDef.placesTile) {
      const tileId = itemDef.placesTile as keyof typeof TILES
      const def = TILES[tileId]
      if (def) this.tilemap.placeTile(tx, ty, def.tileIndex)
    } else if (itemDef.placesEntity) {
      switch (itemDef.placesEntity) {
        case 'BENCH':   createBench(this, tx, ty, this.em); break
        case 'CHEST':   createChest(this, tx, ty, this.em); break
        case 'FURNACE': createFurnace(this, tx, ty, this.em); break
        case 'TORCH':   createTorch(this, tx, ty, this.em); break
        case 'TNT': {
          const tntSprite = this.add.sprite(
            tx * TILE_SIZE + TILE_SIZE / 2,
            ty * TILE_SIZE + TILE_SIZE / 2,
            'tnt',
          ).setDepth(3)
          const tntEnt = new Entity('TNT', tntSprite)
          tntEnt.components.health = { value: 1, max: 1, regenCooldownMs: 0, invincibleMs: 0 }
          this.em.add(tntEnt)
          this.tntEntities.set(tntEnt.id, { fuseMs: -1, tx, ty })
          break
        }
        case 'BED': {
          const bedSprite = this.add.sprite(
            tx * TILE_SIZE + TILE_SIZE / 2,
            ty * TILE_SIZE + TILE_SIZE / 2,
            'bench',  // placeholder sprite
          ).setDepth(3).setTint(0x8888ff)
          const bedEnt = new Entity('BED', bedSprite)
          this.em.add(bedEnt)
          break
        }
      }
    }
    this.checkHouseDetection(tx, ty)
  }

  // ─── House detection ──────────────────────────────────────────────────────

  private checkHouseDetection(originTX: number, originTY: number): void {
    for (let h = 3; h <= 8; h++) {
      for (let w = 3; w <= 8; w++) {
        for (let sy = originTY - h + 1; sy <= originTY; sy++) {
          for (let sx = originTX - w + 1; sx <= originTX; sx++) {
            if (this.isClosedHouseRect(sx, sy, w, h)) {
              useGameStore.getState().promptHouseMint({
                tileX: sx, tileY: sy,
                widthTiles: w, heightTiles: h,
                inventory: {},
              })
              return
            }
          }
        }
      }
    }
  }

  private isClosedHouseRect(sx: number, sy: number, w: number, h: number): boolean {
    const WALL  = TILES.WOOD_WALL.tileIndex
    const FLOOR = TILES.WOOD_FLOOR.tileIndex
    for (let x = sx; x < sx + w; x++) {
      if (this.chunks.getTileIndex(x, sy) !== WALL) return false
      if (this.chunks.getTileIndex(x, sy + h - 1) !== WALL) return false
    }
    for (let y = sy + 1; y < sy + h - 1; y++) {
      if (this.chunks.getTileIndex(sx, y) !== WALL) return false
      if (this.chunks.getTileIndex(sx + w - 1, y) !== WALL) return false
    }
    for (let y = sy + 1; y < sy + h - 1; y++) {
      for (let x = sx + 1; x < sx + w - 1; x++) {
        if (this.chunks.getTileIndex(x, y) === FLOOR) return true
      }
    }
    return false
  }

  // ─── Sync / save ──────────────────────────────────────────────────────────

  private syncReactStore(): void {
    const h   = this.player.components.health!
    const en  = this.player.components.energy!
    const xp  = this.player.components.experience!
    const inv = this.player.components.inventory!
    useGameStore.getState().setPlayerStats({
      health:       h.value,
      maxHealth:    h.max,
      energy:       en.value,
      maxEnergy:    en.max,
      xp:           xp.xp,
      inventory:    Object.fromEntries(inv.items),
      hotbar:       [...inv.hotbar],
      hotbarIndex:  inv.hotbarIndex,
      dayNumber:    this.dayNight.dayNumber,
      stageName:    dayNightStageName(this.dayNight),
      season:       this.currentSeason,
    })
  }

  private doSave(): void {
    const store = useGameStore.getState()
    const h   = this.player.components.health!
    const en  = this.player.components.energy!
    const xp  = this.player.components.experience!
    const inv = this.player.components.inventory!

    savePlayer(store.walletAddress, {
      x: this.player.x, y: this.player.y,
      health: h.value, energy: en.value, xp: xp.xp,
      inventory: Object.fromEntries(inv.items) as Record<string, number>,
      hotbar: inv.hotbar,
    })
    saveWorld(store.walletAddress, {
      seed: store.worldSeed,
      chunks: this.chunks.serialise(),
      dayTimeMs: this.dayNight.totalElapsedMs,
      dayNumber: this.dayNight.dayNumber,
    })
  }

  shutdown(): void {
    if (this.houseMintRequestHandler) {
      window.removeEventListener('gensurvival:requestHouseMint', this.houseMintRequestHandler)
      this.houseMintRequestHandler = null
    }
      if (this.textInputFocusHandler) {
        window.removeEventListener('gensurvival:textInputFocus', this.textInputFocusHandler)
        this.textInputFocusHandler = null
      }
      if (this.hydrateChainStateHandler) {
        window.removeEventListener('gensurvival:hydrateChainState', this.hydrateChainStateHandler)
        this.hydrateChainStateHandler = null
      }
      if (this.chainMineConfirmedHandler) {
        window.removeEventListener('gensurvival:chainMineConfirmed', this.chainMineConfirmedHandler)
        this.chainMineConfirmedHandler = null
      }
      if (this.chainPlaceConfirmedHandler) {
        window.removeEventListener('gensurvival:chainPlaceConfirmed', this.chainPlaceConfirmedHandler)
        this.chainPlaceConfirmedHandler = null
      }
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler)
      this.keyDownHandler = null
    }
    if (this.keyUpHandler) {
      window.removeEventListener('keyup', this.keyUpHandler)
      this.keyUpHandler = null
    }
    if (this.blurHandler) {
      window.removeEventListener('blur', this.blurHandler)
      this.blurHandler = null
    }
    if (this.fishResultHandler) {
      window.removeEventListener('gensurvival:fishResult', this.fishResultHandler)
      this.fishResultHandler = null
    }
    if (this.equipItemHandler) {
      window.removeEventListener('gensurvival:equipItem', this.equipItemHandler)
      this.equipItemHandler = null
    }
    if (this.setHotbarSlotHandler) {
      window.removeEventListener('gensurvival:setHotbarSlot', this.setHotbarSlotHandler)
      this.setHotbarSlotHandler = null
    }
    this.heldKeys.clear()
    this.doSave()
    this.tweens.killAll()
    this.em.clear()
    this.tilemap.destroy()
    this.hpBarGfx?.destroy()
    this.minimapGfx?.destroy()
    this.mapGfx?.destroy()
    this.mapLabel?.destroy()
  }

  // ─── AI event bridge ─────────────────────────────────────────────────────

  applyAIEvent(delta: {
    healthDelta: number; energyDelta: number; xpDelta: number;
    inventoryDelta: Record<string, number>; houseDamaged: boolean;
  }): void {
    const h   = this.player.components.health!
    const en  = this.player.components.energy!
    const xp  = this.player.components.experience!
    const inv = this.player.components.inventory!

    h.value  = Math.max(0.1, Math.min(h.max,  h.value  + delta.healthDelta))
    en.value = Math.max(0,   Math.min(en.max, en.value + delta.energyDelta))
    xp.xp    = Math.max(0,   xp.xp + delta.xpDelta)

    for (const [id, amt] of Object.entries(delta.inventoryDelta)) {
      if (amt > 0) addItem(inv, id as ItemId, amt)
      else if (amt < 0) removeItem(inv, id as ItemId, Math.abs(amt))
    }

    // Push updated stats to React so HUD/panels reflect changes immediately
    this.syncReactStore()
  }
}
