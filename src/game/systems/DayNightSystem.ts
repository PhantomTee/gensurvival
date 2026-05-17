import Phaser from 'phaser'
import { DAY_STAGES } from '../constants'

export interface DayNightState {
  stageIndex: number
  stageElapsedMs: number
  totalElapsedMs: number
  dayNumber: number
}

export function makeDayNight(): DayNightState {
  return { stageIndex: 1, stageElapsedMs: 0, totalElapsedMs: 0, dayNumber: 1 }
}

export function dayNightStageName(state: DayNightState): string {
  return DAY_STAGES[state.stageIndex].name
}

export function totalDayDurationMs(): number {
  return DAY_STAGES.reduce((s, st) => s + st.duration, 0)
}

/** Update time and return interpolated ambient overlay colour + alpha */
export function updateDayNight(
  state: DayNightState,
  dt: number,
): { r: number; g: number; b: number; alpha: number } {
  state.stageElapsedMs += dt
  state.totalElapsedMs += dt

  const stage = DAY_STAGES[state.stageIndex]
  while (state.stageElapsedMs >= stage.duration) {
    state.stageElapsedMs -= stage.duration
    state.stageIndex = (state.stageIndex + 1) % DAY_STAGES.length
    if (state.stageIndex === 0) state.dayNumber++
  }

  // Lerp between current and next stage
  const cur  = DAY_STAGES[state.stageIndex]
  const next = DAY_STAGES[(state.stageIndex + 1) % DAY_STAGES.length]
  const t    = state.stageElapsedMs / cur.duration

  return {
    r:     Phaser.Math.Linear(cur.ambientR, next.ambientR, t),
    g:     Phaser.Math.Linear(cur.ambientG, next.ambientG, t),
    b:     Phaser.Math.Linear(cur.ambientB, next.ambientB, t),
    alpha: Phaser.Math.Linear(cur.alpha,     next.alpha,    t),
  }
}
