import Phaser from 'phaser'
import { useGameStore } from '../../ui/store'

/**
 * MainMenuScene — shows the title and a "Start Game" button.
 * Wallet connection is handled by the React overlay (WalletBadge).
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() { super({ key: 'MainMenuScene' }) }

  create(): void {
    const { width, height } = this.scale

    // Dark background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a)

    // Decorative scanline overlay
    for (let y = 0; y < height; y += 4) {
      this.add.rectangle(width / 2, y, width, 1, 0x000000, 0.12).setDepth(0)
    }

    // Title
    this.add.text(width / 2, height * 0.28, 'GENSURVIVAL', {
      fontSize: '32px',
      color: '#88aaff',
      fontFamily: "'Press Start 2P', monospace",
      shadow: { offsetX: 4, offsetY: 4, color: '#0022aa', blur: 0, fill: true },
    }).setOrigin(0.5)

    this.add.text(width / 2, height * 0.42, 'A GENLAYER SURVIVAL WORLD', {
      fontSize: '10px',
      color: '#4466aa',
      fontFamily: "'Press Start 2P', monospace",
    }).setOrigin(0.5)

    // Key hints strip
    const hints = [
      'WASD — move',
      'J — attack / mine',
      'F — pick up',
      'I — inventory',
      'K — interact',
      'M — map',
    ].join('     ')
    this.add.text(width / 2, height * 0.52, hints, {
      fontSize: '7px',
      color: '#334455',
      fontFamily: "'Press Start 2P', monospace",
    }).setOrigin(0.5)

    // Start button
    const btn = this.add.text(width / 2, height * 0.64, '[ START GAME ]', {
      fontSize: '16px',
      color: '#44ff88',
      fontFamily: "'Press Start 2P', monospace",
      backgroundColor: '#001a00',
      padding: { x: 20, y: 12 },
      shadow: { offsetX: 3, offsetY: 3, color: '#004400', blur: 0, fill: true },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    let clicked = false
    btn.on('pointerover',  () => { if (!clicked) btn.setColor('#88ffaa') })
    btn.on('pointerout',   () => { if (!clicked) btn.setColor('#44ff88') })
    btn.on('pointerdown',  () => {
      if (clicked) return
      clicked = true
      // Visual loading state — grey out immediately so user sees feedback
      btn.setText('[ LOADING... ]')
        .setColor('#556655')
        .setBackgroundColor('#0a0f0a')
        .disableInteractive()
      useGameStore.getState().setScreen('game')
      // Small delay so the re-paint is visible before the heavy WorldScene create() runs
      this.time.delayedCall(80, () => { this.scene.start('WorldScene') })
    })

    // Hint text
    this.add.text(width / 2, height * 0.78, 'Connect wallet (top-right) to save progress on-chain', {
      fontSize: '8px',
      color: '#334455',
      fontFamily: "'Press Start 2P', monospace",
    }).setOrigin(0.5)

    // Version tag
    this.add.text(width - 10, height - 10, 'v0.1-alpha', {
      fontSize: '7px',
      color: '#223344',
      fontFamily: "'Press Start 2P', monospace",
    }).setOrigin(1, 1)
  }
}
