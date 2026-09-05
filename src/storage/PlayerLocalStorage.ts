import type { ItemId } from '../game/registry/ITEMS'

const PREFIX = 'gensurvival_player_'

/**
 * Wallets are inconsistent about address case, and WorldStorage already
 * normalises. Keying one save by the checksummed form and the other by
 * lowercase splits a single player across two saves, which reads as the game
 * forgetting everything.
 */
const keyFor = (walletAddress: string) => PREFIX + (walletAddress.toLowerCase() || 'guest')

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
    localStorage.setItem(keyFor(walletAddress), JSON.stringify(data))
  } catch { /* quota exceeded */ }
}

export function loadPlayer(walletAddress: string): PlayerSave | null {
  try {
    const raw = localStorage.getItem(keyFor(walletAddress))
    return raw ? (JSON.parse(raw) as PlayerSave) : null
  } catch { return null }
}

export function clearPlayer(walletAddress: string): void {
  localStorage.removeItem(keyFor(walletAddress))
}
