const PREFIX = 'gensurvival_world_'
const WORLD_SAVE_VERSION = 5

export interface WorldSave {
  version?: number
  seed: number
  chunks: Record<string, number[]>
  dayTimeMs: number
  dayNumber: number
}

export function saveWorld(walletAddress: string, data: WorldSave): void {
  try {
    localStorage.setItem(PREFIX + (walletAddress || 'guest'), JSON.stringify({
      ...data,
      version: WORLD_SAVE_VERSION,
    }))
  } catch { /* quota exceeded, silently skip */ }
}

export function loadWorld(walletAddress: string): WorldSave | null {
  try {
    const raw = localStorage.getItem(PREFIX + (walletAddress || 'guest'))
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorldSave
    return parsed.version === WORLD_SAVE_VERSION ? parsed : null
  } catch { return null }
}

export function clearWorld(walletAddress: string): void {
  localStorage.removeItem(PREFIX + (walletAddress || 'guest'))
}
