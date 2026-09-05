const PREFIX = 'gensurvival_world_'
// Bump whenever world generation changes. It was left at 5 through the hash
// parity fix, so saves written by the OLD generator still loaded as valid and
// were restored on top of the NEW terrain - the player spawned by the new
// world's rules and then stood in the old world's rock, wedged and unable to
// move. Any change to WorldGenerator must bump this.
const WORLD_SAVE_VERSION = 6

export interface WorldSave {
  version?: number
  seed: number
  chunks: Record<string, number[]>
  dayTimeMs: number
  dayNumber: number
}

export function saveWorld(walletAddress: string, data: WorldSave): void {
  try {
    localStorage.setItem(PREFIX + (walletAddress.toLowerCase() || 'guest'), JSON.stringify({
      ...data,
      version: WORLD_SAVE_VERSION,
    }))
  } catch { /* quota exceeded, silently skip */ }
}

export function loadWorld(walletAddress: string): WorldSave | null {
  try {
    const raw = localStorage.getItem(PREFIX + (walletAddress.toLowerCase() || 'guest'))
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorldSave
    return parsed.version === WORLD_SAVE_VERSION ? parsed : null
  } catch { return null }
}

export function clearWorld(walletAddress: string): void {
  localStorage.removeItem(PREFIX + (walletAddress.toLowerCase() || 'guest'))
}
