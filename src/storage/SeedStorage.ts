const KEY = 'gensurvival_seed_'

/** Get or create a world seed for the given wallet address */
export function getOrCreateSeed(walletAddress: string): number {
  const key = KEY + (walletAddress || 'guest')
  const stored = localStorage.getItem(key)
  if (stored) return parseInt(stored, 10)
  const seed = Math.floor(Math.random() * 2 ** 30)
  localStorage.setItem(key, String(seed))
  return seed
}

export function clearSeed(walletAddress: string): void {
  localStorage.removeItem(KEY + (walletAddress || 'guest'))
}
