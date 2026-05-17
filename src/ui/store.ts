import { create } from 'zustand'
// ─── Toast ────────────────────────────────────────────────────────────────────

export interface ToastMsg {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Screen = 'menu' | 'game'
export type CraftingStation = 'HAND' | 'BENCH' | 'FURNACE'

export interface PlayerStats {
  health: number
  maxHealth: number
  energy: number
  maxEnergy: number
  xp: number
  inventory: Record<string, number>
  hotbar: (string | null)[]
  hotbarIndex: number
  dayNumber: number
  stageName: string
  season: string
}

export interface HouseNFT {
  tokenId: number
  tileX: number
  tileY: number
  widthTiles: number
  heightTiles: number
  quality: number
  damaged: boolean
  name?: string
}

export interface AIEventResult {
  eventType: 'disaster' | 'good' | 'neutral'
  eventName: string
  description: string
  healthDelta: number
  energyDelta: number
  xpDelta: number
  inventoryDelta: Record<string, number>
  houseDamaged: boolean
  houseDamageAmount: number
  houseQualityDelta: number
  reasoning: string
}

export interface LeaderboardEntry {
  address: string
  score: number
  name?: string
}

export interface EpochInfo {
  currentEpoch: number
  inWindow: boolean
  secondsUntilNextWindow: number
  windowEndTs: number
  callsToday: number
}

export interface HouseMintPrompt {
  tileX: number
  tileY: number
  widthTiles: number
  heightTiles: number
  inventory: Record<string, number>
}

// ─── Wallet phase state machine ───────────────────────────────────────────────

export type WalletPhase = 'idle' | 'checking' | 'needs-name' | 'needs-signin' | 'ready'

export interface WalletPending {
  address: string
  seed: number
  name: string   // empty string for brand-new players
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface GameStore {
  // App state
  screen: Screen
  setScreen: (s: Screen) => void

  // Wallet phase & pending data (state machine used by WalletGate overlay)
  walletPhase: WalletPhase
  setWalletPhase: (phase: WalletPhase) => void
  walletPending: WalletPending | null
  setWalletPending: (p: WalletPending | null) => void

  // Wallet
  walletAddress: string
  playerName: string
  isRegistered: boolean
  worldSeed: number
  setWallet: (address: string, name: string, registered: boolean, seed: number) => void
  clearWallet: () => void

  // Player stats (synced from Phaser each frame)
  playerStats: PlayerStats | null
  setPlayerStats: (s: PlayerStats) => void

  // UI panels
  craftingOpen: boolean
  craftingStation: CraftingStation
  craftingEntityId: number | null
  craftingStationX: number   // tile X of the physical station (0 for HAND)
  craftingStationY: number   // tile Y of the physical station (0 for HAND)
  openCrafting: (station: CraftingStation, entityId: number, stationX?: number, stationY?: number) => void
  closeCrafting: () => void

  inventoryOpen: boolean
  toggleInventory: () => void

  chestOpen: boolean
  chestEntityId: number | null
  openChest: (entityId: number) => void
  closeChest: () => void

  leaderboardOpen: boolean
  toggleLeaderboard: () => void

  // House NFT
  houses: HouseNFT[]
  setHouses: (houses: HouseNFT[]) => void
  houseMintPrompt: HouseMintPrompt | null
  promptHouseMint: (p: HouseMintPrompt) => void
  dismissHouseMint: () => void

  // AI events
  epochInfo: EpochInfo | null
  setEpochInfo: (info: EpochInfo) => void
  lastAIEvent: AIEventResult | null
  setLastAIEvent: (r: AIEventResult) => void
  txPending: boolean
  txStatus: string
  setTxStatus: (pending: boolean, status?: string) => void

  // Leaderboard
  leaderboard: LeaderboardEntry[]
  setLeaderboard: (entries: LeaderboardEntry[]) => void

  // Toasts
  toasts: ToastMsg[]
  addToast: (message: string, type: ToastMsg['type']) => void
  removeToast: (id: string) => void
}

export const useGameStore = create<GameStore>((set) => ({
  screen: 'menu',
  setScreen: (screen) => set({ screen }),

  walletPhase: 'idle',
  setWalletPhase: (walletPhase) => set({ walletPhase }),
  walletPending: null,
  setWalletPending: (walletPending) => set({ walletPending }),

  walletAddress: '',
  playerName: '',
  isRegistered: false,
  worldSeed: Math.floor(Math.random() * 2 ** 30),
  setWallet: (walletAddress, playerName, isRegistered, worldSeed) =>
    set({ walletAddress, playerName, isRegistered, worldSeed }),
  clearWallet: () => set({ walletAddress: '', playerName: '', isRegistered: false }),

  playerStats: null,
  setPlayerStats: (playerStats) => set({ playerStats }),

  craftingOpen: false,
  craftingStation: 'HAND',
  craftingEntityId: null,
  craftingStationX: 0,
  craftingStationY: 0,
  openCrafting: (craftingStation, craftingEntityId, craftingStationX = 0, craftingStationY = 0) =>
    set({ craftingOpen: true, craftingStation, craftingEntityId, craftingStationX, craftingStationY }),
  closeCrafting: () => set({ craftingOpen: false }),

  inventoryOpen: false,
  toggleInventory: () => set((s) => ({ inventoryOpen: !s.inventoryOpen })),

  chestOpen: false,
  chestEntityId: null,
  openChest: (chestEntityId) => set({ chestOpen: true, chestEntityId }),
  closeChest: () => set({ chestOpen: false, chestEntityId: null }),

  leaderboardOpen: false,
  toggleLeaderboard: () => set((s) => ({ leaderboardOpen: !s.leaderboardOpen })),

  houses: [],
  setHouses: (houses) => set({ houses }),
  houseMintPrompt: null,
  promptHouseMint: (houseMintPrompt) => set({ houseMintPrompt }),
  dismissHouseMint: () => set({ houseMintPrompt: null }),

  epochInfo: null,
  setEpochInfo: (epochInfo) => set({ epochInfo }),
  lastAIEvent: null,
  setLastAIEvent: (lastAIEvent) => set({ lastAIEvent }),
  txPending: false,
  txStatus: '',
  setTxStatus: (txPending, txStatus = '') => set({ txPending, txStatus }),

  leaderboard: [],
  setLeaderboard: (leaderboard) => set({ leaderboard }),

  toasts: [],
  addToast: (message, type) => set((s) => ({
    toasts: [...s.toasts.slice(-4), { id: `${Date.now()}-${Math.random()}`, message, type }],
  })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
