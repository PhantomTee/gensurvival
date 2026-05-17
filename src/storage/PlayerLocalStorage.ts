import type { ItemId } from '../game/registry/ITEMS'

const PREFIX = 'gensurvival_player_'

export interface PlayerSave {
  x: number
  y: number
  health: number
  energy: number
  xp: number
  inventory: Record<string, number>
  hotbar: (ItemId | null)[]
}

export function savePlayer(walletAddress: string, data: PlayerSave): void {
  try {
    localStorage.setItem(PREFIX + (walletAddress || 'guest'), JSON.stringify(data))
  } catch { /* quota exceeded */ }
}

export function loadPlayer(walletAddress: string): PlayerSave | null {
  try {
    const raw = localStorage.getItem(PREFIX + (walletAddress || 'guest'))
    return raw ? (JSON.parse(raw) as PlayerSave) : null
  } catch { return null }
}

export function clearPlayer(walletAddress: string): void {
  localStorage.removeItem(PREFIX + (walletAddress || 'guest'))
}
