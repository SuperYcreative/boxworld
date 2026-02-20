// Simple Perlin-style noise for terrain generation
// You can tune the values in world.js later to change terrain shape

export class SimplexNoise {
  constructor(seed = Math.random()) {
    this.perm = new Uint8Array(512)
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    // shuffle based on seed
    let s = seed * 2147483647 | 0
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647
      const j = s % (i + 1)
      ;[p[i], p[j]] = [p[j], p[i]]
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]
  }

  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
  lerp(a, b, t) { return a + t * (b - a) }

  grad(hash, x, y) {
    const h = hash & 3
    const u = h < 2 ? x : y
    const v = h < 2 ? y : x
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v)
  }

  noise2D(x, y) {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    x -= Math.floor(x)
    y -= Math.floor(y)
    const u = this.fade(x)
    const v = this.fade(y)
    const p = this.perm
    const a  = p[X] + Y
    const aa = p[a]
    const ab = p[a + 1]
    const b  = p[X + 1] + Y
    const ba = p[b]
    const bb = p[b + 1]
    return this.lerp(
      this.lerp(this.grad(p[aa], x,   y  ), this.grad(p[ba], x-1, y  ), u),
      this.lerp(this.grad(p[ab], x,   y-1), this.grad(p[bb], x-1, y-1), u),
      v
    )
  }

  // Layered noise for more natural terrain
  octaves(x, y, octaves = 4, persistence = 0.5, scale = 0.01) {
    let val = 0, amp = 1, freq = scale, max = 0
    for (let i = 0; i < octaves; i++) {
      val += this.noise2D(x * freq, y * freq) * amp
      max += amp
      amp *= persistence
      freq *= 2
    }
    return val / max
  }
}
