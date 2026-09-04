import Phaser from 'phaser'

/**
 * BootScene — loads all GenSurvival assets, creates normalized 16×16 tile textures,
 * defines walking animations, then hands off to MainMenuScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }) }

  preload(): void {
    const { width, height } = this.scale

    // ── Loading bar ───────────────────────────────────────────────────────────
    const barW = 300
    this.add.rectangle(width / 2, height / 2, barW + 4, 20, 0x111111)
    const fill = this.add
      .rectangle(width / 2 - barW / 2, height / 2, 0, 16, 0x4488ff)
      .setOrigin(0, 0.5)
    this.add
      .text(width / 2, height / 2 - 28, 'Loading…', { fontSize: '14px', color: '#ffffff' })
      .setOrigin(0.5)
    this.load.on('progress', (v: number) => { fill.width = barW * v })

    // ── Tilesets (raw source — may be 32×32; will be scaled to 16×16 in create) ─
    const tileIds = ['void', 'water', 'sand', 'dirt', 'grass',
                     'rock', 'iron_ore', 'wood_floor', 'wood_wall']
    for (const id of tileIds) {
      this.load.image(`_tile_raw_${id}`, `/assets/tilesets/tile_${id}.png`)
    }

    // ── Entity spritesheets (48×128, 16×32 frames — 3 cols × 4 rows) ─────────
    // Each pose is 16px wide × 32px tall; 4 directions × 3 walk frames = 12 frames total.
    const charConf = { frameWidth: 16, frameHeight: 32 }
    for (const name of ['player', 'zombie', 'chicken', 'dog']) {
      this.load.spritesheet(name, `/assets/entities/${name}.png`, charConf)
    }

    // ── Entity static images ──────────────────────────────────────────────────
    // Note: 'tree' is generated procedurally in create() — not loaded from file.
    for (const name of ['bench', 'chest', 'furnace', 'furnace_lit',
                        'torch', 'lantern', 'fish', 'flower', 'tnt']) {
      this.load.image(name, `/assets/entities/${name}.png`)
    }

    // ── Item icons (16×16, loaded as item_<name>) ─────────────────────────────
    const itemFiles = [
      'wood_log', 'wood_plank', 'wood_stick',
      'wood_floor', 'wood_wall', 'bench_item',
      'coal', 'stone', 'iron_ore',
      'iron_sword', 'iron_pickaxe', 'iron_axe', 'iron_hoe', 'iron_shovel',
      'wood_sword', 'wood_pickaxe', 'wood_axe',
      'tnt_item',
    ]
    for (const f of itemFiles) {
      this.load.image(`item_${f}`, `/assets/items/${f}.png`)
    }
  }

  create(): void {
    // ── Build normalized 16×16 tile textures — 4 variants each ───────────────
    // Raw tiles may be 32×32; we scale them to 16×16 then apply:
    //  • per-variant global brightness shift
    //  • per-pixel deterministic noise ±6 % brightness
    //  • type-specific detail overlays (grass tufts, dirt pebbles, rock cracks …)
    // Variants are keyed tile_<id>_0 … tile_<id>_3.
    // TileMapManager picks variant = abs(lx*17 + ly*31) % 4 so adjacent tiles
    // always look slightly different yet the world is deterministic on reload.
    const tileIds = ['void', 'water', 'sand', 'dirt', 'grass',
                     'rock', 'coal_ore', 'iron_ore', 'wood_floor', 'wood_wall']

    // Flat base colours per tile type — avoids any PNG sub-pattern bleeding through.
    // All visual detail comes from the procedural noise + overlay passes below.
    const TILE_BASE: Record<string, [number, number, number]> = {
      void:       [8,   8,   14],
      water:      [42,  100, 175],
      sand:       [205, 178, 98],
      dirt:       [125, 84,  48],
      grass:      [55,  138, 50],
      rock:       [118, 116, 112],
      coal_ore:   [112, 110, 107],
      iron_ore:   [132, 130, 158],
      wood_floor: [180, 138, 72],
      wood_wall:  [132, 96,  36],
    }

    for (const id of tileIds) {
      for (let v = 0; v < 8; v++) {
        const canvas = document.createElement('canvas')
        canvas.width  = 16
        canvas.height = 16
        const ctx = canvas.getContext('2d')!

        // ── PNG-backed tiles: draw the real source PNG, overlay brightness per variant ──
        // Tiles that tile seamlessly (no hard border in the PNG) look best this way.
        // coal_ore has no PNG so it stays procedural; rock uses the cobblestone below.
        const PNG_BACKED = ['void','water','sand','dirt','grass','rock','iron_ore','wood_floor','wood_wall']
        if (PNG_BACKED.includes(id)) {
          const src = this.textures.get(`_tile_raw_${id}`).getSourceImage() as HTMLImageElement | HTMLCanvasElement
          ctx.drawImage(src, 0, 0, 16, 16)

          // Eight brightness steps rather than four: with a hashed variant
          // choice the extra steps read as natural grain instead of a pattern.
          const STEPS = [0, -0.08, 0.06, -0.05, 0.03, -0.11, 0.09, -0.02]
          const step = STEPS[v]
          if (step < 0) { ctx.fillStyle = `rgba(0,0,0,${-step})`;        ctx.fillRect(0, 0, 16, 16) }
          if (step > 0) { ctx.fillStyle = `rgba(255,255,255,${step})`;   ctx.fillRect(0, 0, 16, 16) }

          // Stone reads as a flat blue-grey swatch when tiled over a whole
          // quarry, so give it per-pixel grain and warm it towards the earth
          // tones around it. Deterministic per variant, so no shimmering.
          if (id === 'rock' || id === 'iron_ore') {
            const img = ctx.getImageData(0, 0, 16, 16)
            const d = img.data
            for (let py = 0; py < 16; py++) {
              for (let px = 0; px < 16; px++) {
                const i = (py * 16 + px) * 4
                let n = (Math.imul(px + 1, 374761393) ^ Math.imul(py + 1, 668265263) ^ Math.imul(v + 1, 2246822519)) >>> 0
                n = (n ^ (n >>> 13)) >>> 0
                const jitter = ((n % 21) - 10) * 1.6          // roughly +/- 16
                d[i]     = Math.max(0, Math.min(255, d[i]     + jitter + 6))  // warm up red
                d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + jitter + 2))
                d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + jitter - 7))  // pull down blue
              }
            }
            ctx.putImageData(img, 0, 0)
          }

          this.textures.addCanvas(`tile_${id}_${v}`, canvas)
          continue
        }

        // rock is now included in PNG_BACKED above — no separate block needed

        // Fill with flat base colour — no PNG pattern artefacts
        const [br, bg, bb] = TILE_BASE[id] ?? [128, 128, 128]
        const imgd = ctx.createImageData(16, 16)
        const d    = imgd.data
        for (let i = 0; i < d.length; i += 4) {
          d[i] = br; d[i + 1] = bg; d[i + 2] = bb; d[i + 3] = 255
        }

        // Per-variant global brightness offsets
        const vBright = [0, -0.06, 0.05, -0.03][v]

        // ── Shared 2-D hash — avoids banding from linear hashes ───────────
        // Returns 0-255 with good randomness in both axes.
        const ph = (px: number, py: number, seed: number): number => {
          let h = (Math.imul(px + 1, 0x41c64e6d) ^
                   Math.imul(py + 1, 0x6073)     ^
                   Math.imul(seed + 1, 0x5851f42d)) >>> 0
          h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) >>> 0
          return h & 0xff
        }

        // ── Base noise pass ────────────────────────────────────────────────
        // Stone tiles (rock/coal_ore/iron_ore) use smooth bilinear noise applied
        // in the detail pass below — skip per-pixel static for them.
        const isStone = id === 'rock' || id === 'coal_ore' || id === 'iron_ore'
        if (!isStone) {
          for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
              const i = (py * 16 + px) * 4
              if (d[i + 3] < 32) continue

              const noise = ph(px, py, v ^ 0xabc) / 255   // 0..1

              // Brightness = variant offset ± per-pixel noise in ±8 %
              const b = 1 + vBright + (noise - 0.5) * 0.16

              d[i]     = Math.min(255, Math.max(0, d[i]     * b | 0))
              d[i + 1] = Math.min(255, Math.max(0, d[i + 1] * b | 0))
              d[i + 2] = Math.min(255, Math.max(0, d[i + 2] * b | 0))
            }
          }
        }

        // ── Type-specific detail overlays ──────────────────────────────────
        if (id === 'grass') {
          // Organic tufts using proper hash — no banding
          for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
              const tuft = ph(px, py, v ^ 0x11)
              const i    = (py * 16 + px) * 4
              if (d[i + 3] < 128) continue
              if (tuft < 14) {
                d[i]     = Math.max(0, d[i]     - 32)
                d[i + 1] = Math.min(255, d[i + 1] + 5)
                d[i + 2] = Math.max(0, d[i + 2] - 18)
              } else if (tuft < 22) {
                d[i]     = Math.min(255, d[i]     + 12)
                d[i + 1] = Math.min(255, d[i + 1] + 16)
                d[i + 2] = Math.max(0, d[i + 2] - 6)
              }
            }
          }

        } else if (id === 'dirt') {
          // Scattered pebble dots using proper hash
          for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
              const peb = ph(px, py, v ^ 0x22)
              if (peb < 12) {
                const i = (py * 16 + px) * 4
                d[i]     = Math.max(0, d[i]     - 16)
                d[i + 1] = Math.max(0, d[i + 1] - 13)
                d[i + 2] = Math.max(0, d[i + 2] - 8)
              } else if (peb < 18) {
                const i = (py * 16 + px) * 4
                d[i]     = Math.min(255, d[i]     + 10)
                d[i + 1] = Math.min(255, d[i + 1] + 8)
                d[i + 2] = Math.min(255, d[i + 2] + 5)
              }
            }
          }

        } else if (id === 'rock' || id === 'coal_ore' || id === 'iron_ore') {
          // ── Smooth stone shading via bilinear-interpolated coarse noise ────
          // Build a 5×5 grid of random values, then interpolate them to get
          // smooth, large-scale brightness gradients — no per-pixel static.
          const GRID = 5
          const grid: number[][] = Array.from({ length: GRID }, (_, gy) =>
            Array.from({ length: GRID }, (_, gx) => ph(gx, gy, v ^ 0x30) / 255)
          )
          const bilerp = (tx: number, ty: number): number => {
            const gfx = tx * (GRID - 1), gfy = ty * (GRID - 1)
            const gx0 = Math.floor(gfx) | 0, gy0 = Math.floor(gfy) | 0
            const gx1 = Math.min(gx0 + 1, GRID - 1), gy1 = Math.min(gy0 + 1, GRID - 1)
            const fx = gfx - gx0, fy = gfy - gy0
            return (
              grid[gy0][gx0] * (1 - fx) * (1 - fy) +
              grid[gy0][gx1] *      fx  * (1 - fy) +
              grid[gy1][gx0] * (1 - fx) *      fy  +
              grid[gy1][gx1] *      fx  *      fy
            )
          }

          // Apply variant brightness + smooth gradient + type overlays
          for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
              const i = (py * 16 + px) * 4
              const smooth  = bilerp(px / 15, py / 15)   // 0..1 large-scale gradient
              const smooth2 = bilerp((px + 0.5) / 15, (py + 0.5) / 15)  // offset grid

              // Smooth brightness: variant offset ± 20 % from large-scale gradient
              const b = 1 + vBright + (smooth - 0.5) * 0.40
              d[i]     = Math.min(255, Math.max(0, d[i]     * b | 0))
              d[i + 1] = Math.min(255, Math.max(0, d[i + 1] * b | 0))
              d[i + 2] = Math.min(255, Math.max(0, d[i + 2] * b | 0))

              if (id === 'coal_ore') {
                // Smooth coal vein clusters — use second grid so they follow
                // organic blobs rather than individual pixels
                if (smooth2 < 0.28) {
                  const depth = (0.28 - smooth2) / 0.28  // 0..1 depth into vein
                  const s = Math.round(depth * 65)
                  d[i]     = Math.max(0, d[i]     - s)
                  d[i + 1] = Math.max(0, d[i + 1] - s)
                  d[i + 2] = Math.max(0, d[i + 2] - s)
                }
              } else if (id === 'iron_ore') {
                // Smooth iron vein highlights — warm bluish tint in vein areas
                if (smooth2 > 0.65) {
                  const depth = (smooth2 - 0.65) / 0.35
                  const s = Math.round(depth * 28)
                  d[i]     = Math.max(0, d[i]     - (s >> 1))
                  d[i + 1] = Math.max(0, d[i + 1] - (s >> 1))
                  d[i + 2] = Math.min(255, d[i + 2] + s)
                }
              } else {
                // rock — sparse mineral glints where both grids are bright
                if (smooth > 0.80 && smooth2 > 0.80) {
                  d[i]     = Math.min(255, d[i]     + 18)
                  d[i + 1] = Math.min(255, d[i + 1] + 18)
                  d[i + 2] = Math.min(255, d[i + 2] + 18)
                }
              }

              // Shared: rare dark crack lines where BOTH grids dip very low
              if (smooth < 0.12 && smooth2 < 0.15) {
                d[i]     = Math.max(0, d[i]     - 28)
                d[i + 1] = Math.max(0, d[i + 1] - 28)
                d[i + 2] = Math.max(0, d[i + 2] - 28)
              }
            }
          }

        } else if (id === 'water') {
          // Soft shimmer using hash instead of strict modulo stripes
          for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
              const w = ph(px, py, v ^ 0x44)
              if (w < 24) {
                const i = (py * 16 + px) * 4
                const amt = 14 + (w >> 2)
                d[i]     = Math.min(255, d[i]     + (amt >> 1))
                d[i + 1] = Math.min(255, d[i + 1] + (amt >> 1))
                d[i + 2] = Math.min(255, d[i + 2] + amt)
              }
            }
          }

        } else if (id === 'sand') {
          // Fine grain using proper hash
          for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
              const g = ph(px, py, v ^ 0x55)
              if (g < 16) {
                const amt = g < 8 ? -12 : 11
                const i   = (py * 16 + px) * 4
                d[i]     = Math.min(255, Math.max(0, d[i]     + amt))
                d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + (amt * 0.9) | 0))
                d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + (amt * 0.6) | 0))
              }
            }
          }

        } else if (id === 'wood_floor') {
          // Subtle plank grain — wider planks (8 px), softer seams, hash-varied edges
          for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
              const i   = (py * 16 + px) * 4
              const row = (py + v * 5) % 8
              // Seam at row 0 only; mid-plank gets a very faint lift
              const base = row === 0 ? -6 : row === 4 ? 2 : 0
              if (base === 0) continue
              // Soften with per-pixel noise so seam isn't a hard line
              const soft = base + Math.round((ph(px, py, v ^ 0x66) / 255 - 0.5) * 4)
              d[i]     = Math.min(255, Math.max(0, d[i]     + soft))
              d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + (soft * 0.8) | 0))
              d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + (soft * 0.5) | 0))
            }
          }

        } else if (id === 'wood_wall') {
          // Subtle vertical plank grain — wider planks (8 px), softer seams
          for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
              const i   = (py * 16 + px) * 4
              const col = (px + v * 5) % 8
              const base = col === 0 ? -5 : col === 4 ? 2 : 0
              if (base === 0) continue
              const soft = base + Math.round((ph(px, py, v ^ 0x77) / 255 - 0.5) * 3)
              d[i]     = Math.min(255, Math.max(0, d[i]     + soft))
              d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + (soft * 0.8) | 0))
              d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + (soft * 0.5) | 0))
            }
          }
          // Subtle top mortar seam
          for (let px = 0; px < 16; px++) {
            const i = px * 4
            d[i]     = Math.max(0, d[i]     - 10)
            d[i + 1] = Math.max(0, d[i + 1] - 10)
            d[i + 2] = Math.max(0, d[i + 2] - 10)
          }
        }

        ctx.putImageData(imgd, 0, 0)
        this.textures.addCanvas(`tile_${id}_${v}`, canvas)
      }
    }

    // ── Walking animations ────────────────────────────────────────────────────
    // 48×128 sheet, frameWidth=16 frameHeight=32 → 12 frames total (3 cols × 4 rows)
    // Direction→Row from GenSurvival Direction enum (North=0, East=1, South=2, West=3):
    //   Row 0 (frames  0– 2) = walk UP   (North — facing away)
    //   Row 1 (frames  3– 5) = walk RIGHT (East)
    //   Row 2 (frames  6– 8) = walk DOWN  (South — facing camera, default)
    //   Row 3 (frames  9–11) = walk LEFT  (West)
    //
    // Walk cycle from RendererCreature FRAMES = { 0, 2, 1, 2 }
    // i.e. column order is: left-foot, neutral, right-foot, neutral (not 0→1→2)
    // Idle uses column 2 (neutral) of the current facing row; default South → frame 8.
    const rowForDir: Record<string, number> = { up: 0, right: 1, down: 2, left: 3 }
    for (const key of ['player', 'zombie', 'chicken', 'dog']) {
      for (const [dir, row] of Object.entries(rowForDir)) {
        // Walk: col order 0,2,1,2 within the row
        const base = row * 3
        if (!this.anims.exists(`${key}_walk_${dir}`)) {
          this.anims.create({
            key: `${key}_walk_${dir}`,
            frames: this.anims.generateFrameNumbers(key, {
              frames: [base + 0, base + 2, base + 1, base + 2],
            }),
            frameRate: 8,
            repeat: -1,
          })
        }
      }
      // Idle: neutral pose (col 2) of South row = frame 8
      if (!this.anims.exists(`${key}_idle`)) {
        this.anims.create({
          key: `${key}_idle`,
          frames: this.anims.generateFrameNumbers(key, { frames: [8] }),
          frameRate: 1,
          repeat: -1,
        })
      }
    }

    // ── Procedural item textures for items without PNG assets ─────────────────
    // Each entry: [textureKey, r, g, b, shape]
    // shape: 'square' | 'diamond' | 'dot'
    const PROC_ITEMS: Array<[string, number, number, number, string]> = [
      ['item_iron_ingot',  180, 185, 210, 'square'],   // silver-blue bar
      ['item_raw_meat',    210,  60,  55, 'diamond'],  // red slab
      ['item_cooked_meat', 130,  70,  35, 'diamond'],  // dark brown slab
      ['item_fish',         70, 195, 220, 'diamond'],  // cyan fish shape
      ['item_seeds',       155, 215,  70, 'dot'],      // green-yellow seeds
      ['item_wheat',       240, 205,  60, 'diamond'],  // golden stalk
      ['item_fishing_rod', 185, 155,  90, 'square'],   // tan rod
      ['item_bread',       215, 175, 115, 'square'],   // warm loaf
      ['item_bed',         160, 165, 230, 'square'],   // blue-white blanket
      ['item_bullet',       75,  78,  88, 'dot'],      // dark metal dot
      ['item_pistol',      105, 108, 120, 'square'],   // steel grey
      ['item_rifle',        85,  88, 100, 'square'],   // darker steel
      ['item_torch',       240, 135,  35, 'dot'],      // orange flame
      ['item_lantern',     240, 220,  75, 'square'],   // warm yellow
      ['item_chest',       155, 105,  55, 'square'],   // wooden brown
      ['item_furnace',      95,  85,  78, 'square'],   // dark stone
      ['item_house_deed',  235, 220, 178, 'square'],   // parchment
      ['item_coal_ore',     68,  67,  65, 'square'],   // dark coal
    ]

    for (const [key, r, g, b, shape] of PROC_ITEMS) {
      if (this.textures.exists(key)) continue
      const c = document.createElement('canvas')
      c.width = 8; c.height = 8
      const ctx = c.getContext('2d')!

      ctx.fillStyle = `rgb(${r},${g},${b})`

      if (shape === 'dot') {
        ctx.beginPath()
        ctx.arc(4, 4, 3.5, 0, Math.PI * 2)
        ctx.fill()
      } else if (shape === 'diamond') {
        ctx.beginPath()
        ctx.moveTo(4, 0); ctx.lineTo(8, 4); ctx.lineTo(4, 8); ctx.lineTo(0, 4)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.fillRect(1, 1, 6, 6)
      }

      // Dark 1-px outline for contrast against any background
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth = 1
      if (shape === 'dot') {
        ctx.beginPath()
        ctx.arc(4, 4, 3.5, 0, Math.PI * 2)
        ctx.stroke()
      } else if (shape === 'diamond') {
        ctx.beginPath()
        ctx.moveTo(4, 0); ctx.lineTo(8, 4); ctx.lineTo(4, 8); ctx.lineTo(0, 4)
        ctx.closePath()
        ctx.stroke()
      } else {
        ctx.strokeRect(1, 1, 6, 6)
      }

      this.textures.addCanvas(key, c)
    }

    // ── Procedural tree texture (16×32 — two tiles tall) ─────────────────────
    // The PNG asset was only a crown stub. Drawing the full tree in code gives
    // us a layered crown + trunk that looks complete at game scale.
    {
      const tc = document.createElement('canvas')
      tc.width  = 16
      tc.height = 32
      const cx  = tc.getContext('2d')!
      cx.clearRect(0, 0, 16, 32)

      // Crown — 4 tiers, each wider than the one above
      const tiers = [
        { y: 0,  h: 4,  x: 6, w: 4,  base: '#52d43c', hi: '#68ee50', dk: '#2d9422' },
        { y: 4,  h: 5,  x: 4, w: 8,  base: '#3dba28', hi: '#52d43c', dk: '#237016' },
        { y: 9,  h: 6,  x: 2, w: 12, base: '#2d9420', hi: '#3dba28', dk: '#1a5c10' },
        { y: 15, h: 7,  x: 1, w: 14, base: '#1f7016', hi: '#2d9420', dk: '#124808' },
      ]
      for (const { y, h, x, w, base, hi, dk } of tiers) {
        // Fill
        cx.fillStyle = base
        cx.fillRect(x, y, w, h)
        // 1-px light column — ~1/3 from left
        cx.fillStyle = hi
        cx.fillRect(x + Math.floor(w / 3), y, 1, h)
        // 1-px dark outline on left + right + bottom
        cx.fillStyle = dk
        cx.fillRect(x, y, 1, h)
        cx.fillRect(x + w - 1, y, 1, h)
        cx.fillRect(x, y + h - 1, w, 1)
      }

      // Trunk — 4 px wide, 10 px tall
      cx.fillStyle = '#5c3510'
      cx.fillRect(6, 22, 4, 10)
      cx.fillStyle = '#7a4a20'  // highlight stripe
      cx.fillRect(7, 22, 1, 10)
      cx.fillStyle = '#3d2008'  // shadow stripe
      cx.fillRect(9, 22, 1, 10)

      this.textures.addCanvas('tree', tc)
    }

    this.scene.start('MainMenuScene')
  }
}
