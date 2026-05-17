import type { EntityManager } from '../entities/Entity'

export class EnergySystem {
  update(em: EntityManager, dt: number): void {
    for (const entity of em.all()) {
      const en = entity.components.energy
      if (!en) continue

      // Exponential regen (GenSurvival: regenRate *= 1.02 per game tick at ~60fps)
      // dt is in ms; we normalise to 60fps ticks
      const ticks = dt / 16.67
      if (en.value < en.max) {
        en.value = Math.min(en.max, en.value + en.regenRate * ticks)
        en.regenRate = Math.min(0.5, en.regenRate * Math.pow(1.02, ticks))
      }
    }
  }

  /** Spend energy. Returns false if insufficient. Resets regen rate on use. */
  static spend(em: EntityManager, entityId: number, amount: number): boolean {
    const e = em.get(entityId)
    if (!e?.components.energy) return false
    const en = e.components.energy
    if (en.value < amount) return false
    en.value -= amount
    en.regenRate = 0.01   // reset to base on use
    return true
  }
}
