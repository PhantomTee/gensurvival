import Phaser from 'phaser'

export class PauseScene extends Phaser.Scene {
  constructor() { super({ key: 'PauseScene' }) }

  create(): void {
    const { width, height } = this.scale

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setScrollFactor(0)

    this.add.text(width / 2, height * 0.35, 'PAUSED', {
      fontSize: '36px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0)

    const resume = this.add.text(width / 2, height * 0.5, '[ RESUME ]', {
      fontSize: '22px', color: '#44ff88', fontFamily: 'monospace',
      backgroundColor: '#001a00', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true })

    resume.on('pointerdown', () => {
      this.scene.stop()
      this.scene.resume('WorldScene')
    })

    const quit = this.add.text(width / 2, height * 0.62, '[ QUIT TO MENU ]', {
      fontSize: '18px', color: '#ff6644', fontFamily: 'monospace',
      backgroundColor: '#1a0000', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true })

    quit.on('pointerdown', () => {
      this.scene.stop()
      this.scene.stop('WorldScene')
      this.scene.start('MainMenuScene')
    })

    // ESC also resumes
    this.input.keyboard!.once('keydown-ESC', () => {
      this.scene.stop()
      this.scene.resume('WorldScene')
    })
  }
}
