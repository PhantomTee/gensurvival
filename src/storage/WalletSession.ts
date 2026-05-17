/**
 * Persists the verified wallet session to localStorage so the player is
 * automatically reconnected on page reload without any popup or modal.
 *
 * A session is "verified" once the player has either:
 *   - signed the personal_sign challenge (returning player), or
 *   - completed the on-chain registration transaction (new player).
 *
 * On reload we call eth_accounts (silent, no popup).  If MetaMask still
 * has the same account unlocked the session is restored instantly.
 * If the account changed or MetaMask is locked the saved session is
 * cleared and the player sees the normal "Connect EVM Wallet" button.
 */

const PREFIX = 'gensurvival:session:'

interface WalletSession {
  address: string
  name: string
  seed: number
  verifiedAt: number   // unix ms — for future expiry logic
}

export function saveSession(session: WalletSession): void {
  try {
    localStorage.setItem(PREFIX + 'data', JSON.stringify(session))
  } catch { /* storage full — non-fatal */ }
}

export function loadSession(): WalletSession | null {
  try {
    const raw = localStorage.getItem(PREFIX + 'data')
    if (!raw) return null
    return JSON.parse(raw) as WalletSession
  } catch { return null }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(PREFIX + 'data')
  } catch { /* ignore */ }
}
