import Phaser from 'phaser'
import { useGameStore } from '../../ui/store'

/**
 * MainMenuScene — shows the title and a "Start Game" button.
 *
 * Wallet connection is handled by the React overlay (WalletBadge + WalletGate).
 *
 * Two paths enter the game world:
 *   1. "Start Game" button — requires walletPhase === 'ready' (already connected)
 *   2. gensurvival:startWorld event — dispatched by useWallet.connect() the moment
 *      MetaMask returns an address, so the game screen appears immediately while
 *      the on-chain checks run in the background behind the WalletGate overlay.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() { super({ key: 'MainMenuScene' }) }

  create(): void {
    const { width, height } = this.scale

    // Dark background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1206)

    // Decorative scanline overlay
    for (let y = 0; y < height; y += 4) {
      this.add.rectangle(width / 2, y, width, 1, 0x000000, 0.10).setDepth(0)
    }

    // Title
    this.add.text(width / 2, height * 0.28, 'GENSURVIVAL', {
      fontSize: '32px',
      color: '#9dbf6a',
      fontFamily: "'Press Start 2P', monospace",
      shadow: { offsetX: 4, offsetY: 4, color: '#2f1e08', blur: 0, fill: true },
    }).setOrigin(0.5)

    this.add.text(width / 2, height * 0.42, 'A GENLAYER SURVIVAL WORLD', {
      fontSize: '10px',
      color: '#8a7350',
      fontFamily: "'Press Start 2P', monospace",
    }).setOrigin(0.5)

    // Key hints strip
    const hints = [
      'WASD — move',
      'J — attack / mine',
      'F — pick up / catch chicken',
      'I — inventory',
      'K — interact',
      'M — map',
    ].join('     ')
    this.add.text(width / 2, height * 0.52, hints, {
      fontSize: '7px',
      color: '#6b5a3e',
      fontFamily: "'Press Start 2P', monospace",
    }).setOrigin(0.5)

    // Start button
    const btn = this.add.text(width / 2, height * 0.64, '[ START GAME ]', {
      fontSize: '16px',
      color: '#7ec850',
      fontFamily: "'Press Start 2P', monospace",
      backgroundColor: '#20180a',
      padding: { x: 20, y: 12 },
      shadow: { offsetX: 3, offsetY: 3, color: '#33270f', blur: 0, fill: true },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    // ── Core transition logic ─────────────────────────────────────────────
    let clicked = false

    const doStartWorld = () => {
      if (clicked) return
      clicked = true
      btn.setText('[ LOADING... ]')
        .setColor('#6b5a3e')
        .setBackgroundColor('#171004')
        .disableInteractive()
      useGameStore.getState().setScreen('game')
      // Small delay so the repaint is visible before heavy WorldScene.create() runs
      this.time.delayedCall(80, () => { this.scene.start('WorldScene') })
    }

    // Listen for the event dispatched by useWallet.connect() (and by the button below)
    const startWorldHandler = () => doStartWorld()
    window.addEventListener('gensurvival:startWorld', startWorldHandler)

    // Clean up listener when this scene shuts down (prevents duplicate handlers on restart)
    this.events.once('shutdown', () => {
      window.removeEventListener('gensurvival:startWorld', startWorldHandler)
    })

    // ── Start button ──────────────────────────────────────────────────────
    btn.on('pointerover', () => { if (!clicked) btn.setColor('#a8e072') })
    btn.on('pointerout',  () => { if (!clicked) btn.setColor('#7ec850') })
    btn.on('pointerdown', () => {
      if (clicked) return

      // Must have a fully verified wallet to enter the world from the button.
      // (The connect flow enters via gensurvival:startWorld before phase is 'ready'.)
      const { walletPhase } = useGameStore.getState()
      if (walletPhase !== 'ready') {
        btn.setText('CONNECT WALLET FIRST').setColor('#ff6644')
        this.time.delayedCall(2500, () => {
          if (!clicked) btn.setText('[ START GAME ]').setColor('#44ff88')
        })
        return
      }

      doStartWorld()
    })

    // Hint text
    this.add.text(width / 2, height * 0.78, 'Connect your wallet (top-right) to play', {
      fontSize: '8px',
      color: '#6b5a3e',
      fontFamily: "'Press Start 2P', monospace",
    }).setOrigin(0.5)

    // Version tag
    this.add.text(width - 10, height - 10, 'v0.1-alpha', {
      fontSize: '7px',
      color: '#4a3d29',
      fontFamily: "'Press Start 2P', monospace",
    }).setOrigin(1, 1)
  }
}
