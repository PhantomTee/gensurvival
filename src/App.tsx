import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { BootScene }     from './game/scenes/BootScene'
import { MainMenuScene } from './game/scenes/MainMenuScene'
import { WorldScene }    from './game/scenes/WorldScene'
import { PauseScene }    from './game/scenes/PauseScene'
import { HUDBar }          from './ui/components/HUDBar'
import { Hotbar }          from './ui/components/Hotbar'
import { InventoryPanel }  from './ui/components/InventoryPanel'
import { CraftingPanel }   from './ui/components/CraftingPanel'
import { WalletBadge }     from './ui/components/WalletBadge'
import { EpochTimer }      from './ui/components/EpochTimer'
import { EventResultCard } from './ui/components/EventResultCard'
import { LeaderboardModal} from './ui/components/Leaderboard'
import { HouseMintModal }  from './ui/components/HouseMintModal'
import { WalletGate }      from './ui/components/WalletGate'
import { ToastContainer }  from './ui/components/Toast'
import { useGameStore }    from './ui/store'
import { useChainActions } from './ui/hooks/useChainActions'
import { getPlayerState, recordSurvivalDay } from './chain/contracts'
import { pickRendererType } from './game/renderer'
import { createWriteClient } from './chain/client'

function App() {
  const canvasRef     = useRef<HTMLDivElement>(null)
  const gameRef       = useRef<Phaser.Game | null>(null)
  const screen        = useGameStore((s) => s.screen)
  const walletAddress = useGameStore((s) => s.walletAddress)
  const dayNumber     = useGameStore((s) => s.playerStats?.dayNumber ?? 0)
  const lastDayRef    = useRef(0)
  const prevScreenRef = useRef<'menu' | 'game'>('menu')
  const chain    = useChainActions()
  // Stable ref — lets the mount-only event-listener effect always call the
  // current chain without listing `chain` as a dependency (which would
  // re-create listeners every time setPlayerStats fires).
  const chainRef = useRef(chain)

  useEffect(() => {
    chainRef.current = chain
  }, [chain])

  // ── Mount Phaser once ───────────────────────────────────────────────────────
  useEffect(() => {
    if (gameRef.current || !canvasRef.current) return

    gameRef.current = new Phaser.Game({
      type:            pickRendererType(),
      parent:          canvasRef.current,
      width:           window.innerWidth,
      height:          window.innerHeight,
      backgroundColor: '#0a0a1a',
      pixelArt:        true,   // nearest-neighbour filtering — no pixel bleeding at seams
      audio:           { noAudio: true },
      scene:           [BootScene, MainMenuScene, WorldScene, PauseScene],
      physics: {
        default: 'arcade',
        arcade:  { debug: false },
      },
      scale: {
        mode:       Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    })

    // Bridge Phaser → React: apply AI event and craft deltas
    const handleAIEvent = ((e: CustomEvent) => {
      const worldScene = gameRef.current?.scene.getScene('WorldScene') as WorldScene | null
      worldScene?.applyAIEvent(e.detail)
    }) as EventListener

    const handleCraftDelta = ((e: CustomEvent) => {
      const worldScene = gameRef.current?.scene.getScene('WorldScene') as WorldScene | null
      if (!worldScene) return
      const delta = e.detail as { deduct: Record<string, number>; grant: Record<string, number> }
      worldScene.applyAIEvent({
        healthDelta: 0, energyDelta: 0, xpDelta: 0,
        inventoryDelta: {
          ...Object.fromEntries(Object.entries(delta.deduct).map(([k, v]) => [k, -v])),
          ...delta.grant,
        },
        houseDamaged: false,
      })
    }) as EventListener

    window.addEventListener('gensurvival:aiEvent', handleAIEvent)
    window.addEventListener('gensurvival:craftDelta', handleCraftDelta)

    return () => {
      window.removeEventListener('gensurvival:aiEvent', handleAIEvent)
      window.removeEventListener('gensurvival:craftDelta', handleCraftDelta)
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  // When disconnect() forces screen → 'menu', tell Phaser to return to MainMenuScene
  useEffect(() => {
    if (prevScreenRef.current === 'game' && screen === 'menu') {
      const game = gameRef.current
      if (game) {
        const world = game.scene.getScene('WorldScene')
        if (world?.scene.isActive()) {
          game.scene.stop('WorldScene')
          game.scene.stop('PauseScene')
          game.scene.start('MainMenuScene')
        }
      }
    }
    prevScreenRef.current = screen
  }, [screen])

  // Mount-only: listeners use chainRef.current so they always call the latest
  // chain functions without this effect needing to re-run (no [chain] dep).
  useEffect(() => {
    const handleMineTile = ((e: CustomEvent) => {
      const { x, y, terrainType } = e.detail as { x: number; y: number; terrainType: string }
      void chainRef.current.doMineTile(x, y, terrainType)
    }) as EventListener

    const handleChopTree = ((e: CustomEvent) => {
      const { x, y } = e.detail as { x: number; y: number }
      void chainRef.current.doChopTree(x, y)
    }) as EventListener

    const handlePlaceBuild = ((e: CustomEvent) => {
      const { x, y, itemId } = e.detail as { x: number; y: number; itemId: string }
      void chainRef.current.doPlaceBuildTile(x, y, itemId)
    }) as EventListener

    const handleFishAction = ((e: CustomEvent) => {
      const { x, y } = e.detail as { x: number; y: number }
      void chainRef.current.doFishTile(x, y)
    }) as EventListener

    window.addEventListener('gensurvival:mineTile', handleMineTile)
    window.addEventListener('gensurvival:chopTree', handleChopTree)
    window.addEventListener('gensurvival:placeBuildTile', handlePlaceBuild)
    window.addEventListener('gensurvival:fishAction', handleFishAction)

    return () => {
      window.removeEventListener('gensurvival:mineTile', handleMineTile)
      window.removeEventListener('gensurvival:chopTree', handleChopTree)
      window.removeEventListener('gensurvival:placeBuildTile', handlePlaceBuild)
      window.removeEventListener('gensurvival:fishAction', handleFishAction)
    }
  }, [])

  useEffect(() => {
    if (!walletAddress || screen !== 'game') return
    let cancelled = false
    void getPlayerState(walletAddress).then((state) => {
      if (!cancelled && state) {
        window.dispatchEvent(new CustomEvent('gensurvival:hydrateChainState', { detail: state }))
      }
    })
    return () => { cancelled = true }
  }, [walletAddress, screen])

  // Record survival day on-chain whenever dayNumber increments (best-effort, non-blocking).
  useEffect(() => {
    if (!walletAddress || screen !== 'game') return
    if (dayNumber > lastDayRef.current) {
      const prev = lastDayRef.current
      lastDayRef.current = dayNumber
      // Don't fire on initial mount (prev === 0 means we haven't played yet)
      if (prev > 0) {
        const client = createWriteClient(walletAddress)
        recordSurvivalDay(client, dayNumber).catch(() => { /* best-effort — ignore failures */ })
      }
    }
  }, [dayNumber, walletAddress, screen])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Phaser canvas container */}
      <div ref={canvasRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

      {/* WalletBadge — always visible so the user can connect from the main menu */}
      <WalletBadge />

      {/* WalletGate — full-screen overlay while wallet connect is in progress */}
      <WalletGate />

      {/* React UI overlay — pointer-events are managed per-component */}
      {screen === 'game' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 10,
        }}>
          <HUDBar />
          <EpochTimer />

          {/* Controls hint — bottom-left */}
          <ControlsHint />

          {/* Hotbar — bottom-centre, always visible */}
          <Hotbar />

          {/* Panels — these need pointer events */}
          <div style={{ pointerEvents: 'auto' }}>
            <InventoryPanel />
            <CraftingPanel />
            <HouseMintModal />
            <EventResultCard />
            <LeaderboardModal />
          </div>
        </div>
      )}

      {/* Global keyboard shortcuts */}
      {screen === 'game' && <KeyboardShortcuts />}

      {/* Toast notifications — always mounted, always on top */}
      <ToastContainer />
    </div>
  )
}

const KEY_HINTS = [
  { key: 'WASD', label: 'Move' },
  { key: '1-5', label: 'Select hotbar slot' },
  { key: 'J', label: 'Attack / Mine / Shoot' },
  { key: 'F', label: 'Pick up / Tame dog' },
  { key: 'E', label: 'Eat equipped food' },
  { key: 'M', label: 'Map (WASD to pan)' },
  { key: 'K', label: 'Interact / Fish' },
  { key: 'RMB', label: 'Place equipped' },
  { key: 'I', label: 'Inventory (click to equip)' },
  { key: 'L', label: 'Leaderboard' },
  { key: 'ESC', label: 'Pause' },
]

function ControlsHint() {
  return (
    <div style={{
      position: 'absolute', bottom: 12, left: 12,
      background: 'linear-gradient(180deg,rgba(28,16,8,0.9) 0%,rgba(17,9,0,0.9) 100%)',
      border: '1px solid #5a3d10',
      borderRadius: 4,
      padding: '6px 10px',
      pointerEvents: 'none', userSelect: 'none',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      {KEY_HINTS.map(({ key, label }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: 7, fontWeight: 'bold',
            color: '#f5c842', background: '#2a1a08',
            border: '1px solid #8b6914', borderRadius: 2,
            padding: '1px 4px', minWidth: 26, textAlign: 'center',
            letterSpacing: 0.5,
          }}>{key}</span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: '#6b5a30' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

function KeyboardShortcuts() {
  const toggleInv = useGameStore((s) => s.toggleInventory)
  const toggleLB  = useGameStore((s) => s.toggleLeaderboard)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't steal keys when Phaser has focus on canvas
      if (document.activeElement?.tagName === 'INPUT') return
      if (e.key === 'i' || e.key === 'I') toggleInv()
      if (e.key === 'l' || e.key === 'L') toggleLB()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleInv, toggleLB])

  return null
}

export default App
