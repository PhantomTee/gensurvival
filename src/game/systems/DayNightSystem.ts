import Phaser from 'phaser'
import { DAY_STAGES } from '../constants'

export interface DayNightState {
  stageIndex: number
  stageElapsedMs: number
  totalElapsedMs: number
  dayNumber: number
}

export function makeDayNight(): DayNightState {
  // Seed totalElapsedMs from the real UTC+1 clock so the in-game time of day
  // matches the player's local wall clock (cycle origin = 06:00 UTC+1 = dawn).
  const now = new Date()
  const msFromMidnightUTC =
    now.getUTCHours() * 3_600_000 +
    now.getUTCMinutes() * 60_000 +
    now.getUTCSeconds() * 1_000 +
    now.getUTCMilliseconds()
  const msFromMidnightUTC1 = (msFromMidnightUTC + 3_600_000) % 86_400_000
  // Shift so that 06:00 UTC+1 = 0 ms (start of dawn stage)
  const totalElapsedMs = (msFromMidnightUTC1 - 6 * 3_600_000 + 86_400_000) % 86_400_000

  // Walk through DAY_STAGES to find which stage we are currently in
  let stageIndex = DAY_STAGES.length - 1
  let acc = 0
  for (let i = 0; i < DAY_STAGES.length; i++) {
    if (totalElapsedMs < acc + DAY_STAGES[i].duration) {
      stageIndex = i
      break
    }
    acc += DAY_STAGES[i].duration
  }
  const stageElapsedMs =
    totalElapsedMs - DAY_STAGES.slice(0, stageIndex).reduce((s, st) => s + st.duration, 0)

  return { stageIndex, stageElapsedMs, totalElapsedMs, dayNumber: 1 }
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

  while (state.stageElapsedMs >= DAY_STAGES[state.stageIndex].duration) {
    state.stageElapsedMs -= DAY_STAGES[state.stageIndex].duration
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
