import type { WorldGenerator, GeneratedChunk } from './WorldGenerator'
import { CHUNK_SIZE } from '../constants'

/** Manages which chunks are currently loaded in memory */
export class ChunkManager {
  private chunks: Map<string, GeneratedChunk> = new Map()
  private generator: WorldGenerator

  constructor(generator: WorldGenerator) {
    this.generator = generator
  }

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`
  }

  getOrGenerate(cx: number, cy: number): GeneratedChunk {
    const k = this.key(cx, cy)
    if (!this.chunks.has(k)) {
      this.chunks.set(k, this.generator.generateChunk(cx, cy, CHUNK_SIZE))
    }
    return this.chunks.get(k)!
  }

  /** Returns tile index at world tile coords */
  getTileIndex(tx: number, ty: number): number {
    const cx = Math.floor(tx / CHUNK_SIZE)
    const cy = Math.floor(ty / CHUNK_SIZE)
    const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const chunk = this.getOrGenerate(cx, cy)
    return chunk.tiles[ly * CHUNK_SIZE + lx]
  }

  setTileIndex(tx: number, ty: number, index: number): void {
    const cx = Math.floor(tx / CHUNK_SIZE)
    const cy = Math.floor(ty / CHUNK_SIZE)
    const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const chunk = this.getOrGenerate(cx, cy)
    chunk.tiles[ly * CHUNK_SIZE + lx] = index
  }

  /** Pre-generate chunks around a centre chunk position */
  preload(centerCX: number, centerCY: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.getOrGenerate(centerCX + dx, centerCY + dy)
      }
    }
  }

  /** Unload chunks outside of range to free memory */
  evict(centerCX: number, centerCY: number, keepRadius: number): void {
    for (const key of this.chunks.keys()) {
      const [cx, cy] = key.split(',').map(Number)
      if (Math.abs(cx - centerCX) > keepRadius || Math.abs(cy - centerCY) > keepRadius) {
        this.chunks.delete(key)
      }
    }
  }

  /** Serialise loaded chunks to JSON (for save system) */
  serialise(): Record<string, number[]> {
    const out: Record<string, number[]> = {}
    for (const [k, chunk] of this.chunks) {
      out[k] = Array.from(chunk.tiles)
    }
    return out
  }

  /** Restore chunks from saved data */
  restore(data: Record<string, number[]>): void {
    for (const [k, tiles] of Object.entries(data)) {
      const existing = this.chunks.get(k)
      if (existing) {
        existing.tiles.set(tiles)
      } else {
        const [cx, cy] = k.split(',').map(Number)
        const chunk = this.generator.generateChunk(cx, cy, CHUNK_SIZE)
        chunk.tiles.set(tiles)
        this.chunks.set(k, chunk)
      }
    }
  }
}
