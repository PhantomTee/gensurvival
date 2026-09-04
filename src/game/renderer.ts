import Phaser from 'phaser'

/**
 * Pick a Phaser renderer that this device can actually drive.
 *
 * Phaser.AUTO only falls back to Canvas when *context creation* fails. On some
 * drivers, software renderers and VMs the WebGL context is created happily and
 * then framebuffer allocation throws ("Framebuffer status: Incomplete
 * Attachment") during renderer init — after AUTO has already committed. The
 * error escapes as an uncaught exception and the player is left staring at a
 * black canvas with no explanation.
 *
 * So probe the one operation that fails: attach a texture to a framebuffer and
 * ask WebGL whether the result is complete. Cheap, synchronous, and it runs
 * before Phaser boots.
 */
export function pickRendererType(): number {
  if (typeof document === 'undefined') return Phaser.CANVAS

  let gl: WebGLRenderingContext | null = null
  try {
    const probe = document.createElement('canvas')
    probe.width = 2
    probe.height = 2
    gl =
      (probe.getContext('webgl2') as WebGLRenderingContext | null) ??
      (probe.getContext('webgl') as WebGLRenderingContext | null) ??
      (probe.getContext('experimental-webgl') as WebGLRenderingContext | null)
  } catch {
    return Phaser.CANVAS
  }

  if (!gl) return Phaser.CANVAS

  try {
    const texture = gl.createTexture()
    const framebuffer = gl.createFramebuffer()
    if (!texture || !framebuffer) return Phaser.CANVAS

    // Probe at something close to the size Phaser will really allocate. A 2x2
    // framebuffer succeeds on drivers where a viewport-sized one does not, so
    // the small probe passed and the game still died on the first real frame.
    const probeW = Math.min(2048, Math.max(512, window.innerWidth || 1024))
    const probeH = Math.min(2048, Math.max(512, window.innerHeight || 768))

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, probeW, probeH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.deleteFramebuffer(framebuffer)
    gl.deleteTexture(texture)

    // A driver error raised during the probe counts as failure too.
    const glError = gl.getError()

    if (status !== gl.FRAMEBUFFER_COMPLETE || glError !== gl.NO_ERROR) {
      console.warn(
        `[renderer] WebGL framebuffers unusable (status 0x${status.toString(16)}, ` +
          `error 0x${glError.toString(16)}) — falling back to the Canvas renderer.`,
      )
      return Phaser.CANVAS
    }
  } catch {
    return Phaser.CANVAS
  }

  return Phaser.WEBGL
}
