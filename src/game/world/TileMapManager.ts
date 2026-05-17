import Phaser from 'phaser'
import type { ChunkManager } from './ChunkManager'
import { TILES, TILE_BY_INDEX } from '../registry/TILES'
import { TILE_SIZE, CHUNK_SIZE } from '../constants'

const RENDER_RADIUS = 3   // chunks rendered around the camera

/**
 * Renders the tile world using a pool of Phaser.GameObjects.TileSprite /
 * Graphics objects keyed by chunk. Chunks are rendered on demand and
 * destroyed when outside the render radius.
 */
export class TileMapManager {
  private scene: Phaser.Scene
  private chunks: ChunkManager
  private renderedChunks: Map<string, Phaser.GameObjects.RenderTexture> = new Map()
  private solidCache: Map<string, boolean> = new Map()

  constructor(scene: Phaser.Scene, chunks: ChunkManager) {
    this.scene = scene
    this.chunks = chunks
  }

  /** Called each frame — renders visible chunks and culls distant ones */
  update(camX: number, camY: number): void {
    const cx = Math.floor(camX / (CHUNK_SIZE * TILE_SIZE))
    const cy = Math.floor(camY / (CHUNK_SIZE * TILE_SIZE))

    // Render nearby chunks
    for (let dy = -RENDER_RADIUS; dy <= RENDER_RADIUS; dy++) {
      for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
        this.ensureChunkRendered(cx + dx, cy + dy)
      }
    }

    // Cull distant chunks
    const keep = new Set<string>()
    for (let dy = -RENDER_RADIUS; dy <= RENDER_RADIUS; dy++) {
      for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
        keep.add(`${cx + dx},${cy + dy}`)
      }
    }
    for (const [key, rt] of this.renderedChunks) {
      if (!keep.has(key)) {
        rt.destroy()
        this.renderedChunks.delete(key)
      }
    }
  }

  private ensureChunkRendered(cx: number, cy: number): void {
    const key = `${cx},${cy}`
    if (this.renderedChunks.has(key)) return

    const chunkPxW = CHUNK_SIZE * TILE_SIZE
    const chunkPxH = CHUNK_SIZE * TILE_SIZE
    const rt = this.scene.add.renderTexture(cx * chunkPxW, cy * chunkPxH, chunkPxW, chunkPxH)
    rt.setOrigin(0, 0)
    rt.setDepth(-10)

    const chunk = this.chunks.getOrGenerate(cx, cy)

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tileIndex = chunk.tiles[ly * CHUNK_SIZE + lx]
        const tileId    = TILE_BY_INDEX[tileIndex] ?? 'VOID'

        // Pick one of 4 variants using a position hash — deterministic, never
        // the same variant for two adjacent tiles, looks organic at any zoom.
        // World tile coords: wx = cx*CHUNK_SIZE + lx, wy = cy*CHUNK_SIZE + ly
        const wx      = cx * CHUNK_SIZE + lx
        const wy      = cy * CHUNK_SIZE + ly
        const variant = Math.abs(wx * 17 + wy * 31) % 4
        const tileKey = `tile_${tileId.toLowerCase()}_${variant}`

        if (this.scene.textures.exists(tileKey)) {
          // stamp() centers on the given coord; shift by half-tile to top-left origin
          rt.stamp(tileKey, undefined,
            lx * TILE_SIZE + TILE_SIZE / 2,
            ly * TILE_SIZE + TILE_SIZE / 2,
          )
        } else {
          // Fallback: solid colour from tile definition while textures load
          const def = TILES[tileId]
          const gfx = this.scene.add.graphics()
          gfx.fillStyle(def?.color ?? 0x000000, 1)
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
          rt.draw(gfx, lx * TILE_SIZE, ly * TILE_SIZE)
          gfx.destroy()
        }
      }
    }

    this.renderedChunks.set(key, rt)
  }

  /** Returns true if the tile at world tile coords (tx, ty) blocks movement */
  isSolid(tx: number, ty: number): boolean {
    const key = `${tx},${ty}`
    if (this.solidCache.has(key)) return this.solidCache.get(key)!
    const idx = this.chunks.getTileIndex(tx, ty)
    const tileId = TILE_BY_INDEX[idx]
    const solid  = TILES[tileId]?.solid ?? true
    this.solidCache.set(key, solid)
    return solid
  }

  /** Break a tile — replace with DIRT (index 3), invalidate solid cache */
  breakTile(tx: number, ty: number): string | null {
    const idx    = this.chunks.getTileIndex(tx, ty)
    const tileId = TILE_BY_INDEX[idx]
    const def    = TILES[tileId]
    if (!def?.breakable) return null

    const drop = def.dropItem ?? null
    this.chunks.setTileIndex(tx, ty, 3)  // 3 = DIRT
    this.solidCache.delete(`${tx},${ty}`)

    // Force re-render of the owning chunk
    const cx  = Math.floor(tx / CHUNK_SIZE)
    const cy  = Math.floor(ty / CHUNK_SIZE)
    const key = `${cx},${cy}`
    this.renderedChunks.get(key)?.destroy()
    this.renderedChunks.delete(key)

    return drop
  }

  /** Place a tile at world tile coords */
  placeTile(tx: number, ty: number, tileIndex: number): void {
    this.chunks.setTileIndex(tx, ty, tileIndex)
    this.solidCache.delete(`${tx},${ty}`)
    const cx  = Math.floor(tx / CHUNK_SIZE)
    const cy  = Math.floor(ty / CHUNK_SIZE)
    const key = `${cx},${cy}`
    this.renderedChunks.get(key)?.destroy()
    this.renderedChunks.delete(key)
  }

  /** Convert pixel coords to world tile coords */
  static pixelToTile(px: number, py: number): { tx: number; ty: number } {
    return {
      tx: Math.floor(px / TILE_SIZE),
      ty: Math.floor(py / TILE_SIZE),
    }
  }

  destroy(): void {
    for (const rt of this.renderedChunks.values()) rt.destroy()
    this.renderedChunks.clear()
  }
}
