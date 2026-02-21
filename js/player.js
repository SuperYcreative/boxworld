import * as THREE from 'three'
import { BLOCKS } from './chunk.js'

const GRAVITY        = -28
const WATER_GRAVITY  = -6   // reduced gravity while submerged (#19)
const SWIM_FORCE     =  5   // upward force when Space is held underwater (#19)
const WATER_DRAG     =  0.8 // velocity damping per second while in water (#19)
const JUMP_FORCE     = 10
const MOVE_SPEED     = 6
const PLAYER_HEIGHT  = 1.7
const PLAYER_WIDTH   = 0.4
const REACH          = 5

export class Player {
  constructor(camera, world) {
    this.camera = camera
    this.world  = world

    this.pos = new THREE.Vector3(0, 40, 0)
    this.vel = new THREE.Vector3(0, 0, 0)
    this.onGround = false

    this.yaw   = 0
    this.pitch = 0

    this.selectedBlock = BLOCKS.GRASS

    // Reusable vectors — allocated once, never inside the game loop (#6, #7)
    this._forward = new THREE.Vector3()
    this._right   = new THREE.Vector3()
    this._move    = new THREE.Vector3()
    this._rayPos  = new THREE.Vector3()
    this._rayDir  = new THREE.Vector3()

    this.keys = {}
    this.initControls()
  }

  initControls() {
    document.addEventListener('keydown', e => { this.keys[e.code] = true })
    document.addEventListener('keyup',   e => { this.keys[e.code] = false })

    document.addEventListener('mousemove', e => {
      if (!document.pointerLockElement) return
      this.yaw   -= e.movementX * 0.002
      this.pitch -= e.movementY * 0.002
      this.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch))
    })

    document.addEventListener('mousedown', e => {
      if (!document.pointerLockElement) return
      if (e.button === 0) this.breakBlock()
      if (e.button === 2) this.placeBlock()
    })

    document.addEventListener('contextmenu', e => e.preventDefault())

    document.addEventListener('keydown', e => {
      const map = {
        Digit1: BLOCKS.GRASS,
        Digit2: BLOCKS.DIRT,
        Digit3: BLOCKS.STONE,
        Digit4: BLOCKS.WOOD,
        Digit5: BLOCKS.LEAVES,
        Digit6: BLOCKS.SAND,
      }
      if (map[e.code] !== undefined) this.selectedBlock = map[e.code]
    })
  }

  spawn() {
    const h = this.world.getSurfaceHeight(0, 0)
    this.pos.set(0, h + 2, 0)
  }

  update(dt) {
    this.updateCamera()
    this.handleMovement(dt)
    this.applyPhysics(dt)
  }

  updateCamera() {
    this.camera.position.copy(this.pos)
    this.camera.position.y += PLAYER_HEIGHT - 0.1
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = this.yaw
    this.camera.rotation.x = this.pitch
  }

  // Returns true if the player's eye/mid point is inside a water block (#19)
  _isInWater() {
    const eyeY = Math.floor(this.pos.y + PLAYER_HEIGHT * 0.5)
    const bx   = Math.floor(this.pos.x)
    const bz   = Math.floor(this.pos.z)
    return this.world.getBlockWorld(bx, eyeY, bz) === BLOCKS.WATER
  }

  handleMovement(dt) {
    // Reuse class-level vectors (#6)
    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    this._move.set(0, 0, 0)

    if (this.keys['KeyW']) this._move.add(this._forward)
    if (this.keys['KeyS']) this._move.sub(this._forward)
    if (this.keys['KeyA']) this._move.sub(this._right)
    if (this.keys['KeyD']) this._move.add(this._right)

    if (this._move.lengthSq() > 0) {
      this._move.normalize().multiplyScalar(MOVE_SPEED)
    }

    this.vel.x = this._move.x
    this.vel.z = this._move.z

    const inWater = this._isInWater()

    if (inWater) {
      // Swim upward when Space held; water drag slows vertical fall (#19)
      if (this.keys['Space']) {
        this.vel.y += SWIM_FORCE * dt * 60 * dt // impulse-style, frame-rate independent
        if (this.vel.y > SWIM_FORCE) this.vel.y = SWIM_FORCE
      }
    } else {
      if (this.keys['Space'] && this.onGround) {
        this.vel.y = JUMP_FORCE
        this.onGround = false
      }
    }
  }

  applyPhysics(dt) {
    const inWater = this._isInWater()

    // Apply appropriate gravity (#19)
    this.vel.y += (inWater ? WATER_GRAVITY : GRAVITY) * dt

    // Apply water drag to vertical velocity (#19)
    if (inWater) {
      this.vel.y *= Math.pow(1 - WATER_DRAG, dt)
    }

    // Axis-separated movement and collision
    this.pos.x += this.vel.x * dt
    this.collideAxis('x')

    this.pos.y += this.vel.y * dt
    this.collideAxis('y')

    this.pos.z += this.vel.z * dt
    this.collideAxis('z')
  }

  collideAxis(axis) {
    const w = PLAYER_WIDTH / 2

    // Y axis now checks all four bottom corners and all four top corners (#3)
    // X and Z axes check four edges along full player height
    const offsets = []

    if (axis === 'y') {
      // Four corners at feet and four at head
      for (const [sx, sz] of [[-w, -w], [w, -w], [-w, w], [w, w]]) {
        offsets.push([sx, 0,             sz]) // feet
        offsets.push([sx, PLAYER_HEIGHT, sz]) // head
      }
    } else if (axis === 'x') {
      for (let dy = 0; dy <= Math.ceil(PLAYER_HEIGHT); dy++) {
        offsets.push([ w, dy, 0], [-w, dy, 0])
      }
    } else {
      for (let dy = 0; dy <= Math.ceil(PLAYER_HEIGHT); dy++) {
        offsets.push([0, dy,  w], [0, dy, -w])
      }
    }

    for (const [ox, oy, oz] of offsets) {
      const bx    = Math.floor(this.pos.x + ox)
      const by    = Math.floor(this.pos.y + oy)
      const bz    = Math.floor(this.pos.z + oz)
      const block = this.world.getBlockWorld(bx, by, bz)

      if (block !== BLOCKS.AIR && block !== BLOCKS.WATER && block > 0) {
        if (axis === 'y') {
          if (this.vel.y < 0) {
            this.pos.y    = by + 1
            this.onGround = true
          } else {
            this.pos.y = by - PLAYER_HEIGHT
          }
          this.vel.y = 0
        } else if (axis === 'x') {
          this.pos.x = ox > 0 ? bx - w : bx + 1 + w
          this.vel.x = 0
        } else {
          this.pos.z = oz > 0 ? bz - w : bz + 1 + w
          this.vel.z = 0
        }
        break
      }
    }

    if (axis === 'y' && this.vel.y !== 0) this.onGround = false
  }

  // DDA raycast — exact, fast, no floating-point step accumulation (#11)
  // Returns { hit: {x,y,z}, before: {x,y,z} } or null
  raycast() {
    // Build direction vector from current look angles, reusing class vector (#7)
    this._rayDir.set(0, 0, -1).applyEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
    )
    this._rayPos.copy(this.camera.position)

    const dx = this._rayDir.x
    const dy = this._rayDir.y
    const dz = this._rayDir.z

    // Current voxel
    let ix = Math.floor(this._rayPos.x)
    let iy = Math.floor(this._rayPos.y)
    let iz = Math.floor(this._rayPos.z)

    // Step direction per axis
    const stepX = dx >= 0 ? 1 : -1
    const stepY = dy >= 0 ? 1 : -1
    const stepZ = dz >= 0 ? 1 : -1

    // How far along the ray we must travel for one voxel step on each axis
    const tDeltaX = Math.abs(1 / dx)
    const tDeltaY = Math.abs(1 / dy)
    const tDeltaZ = Math.abs(1 / dz)

    // Initial distances to the first voxel boundary on each axis
    const ox = this._rayPos.x - ix
    const oy = this._rayPos.y - iy
    const oz = this._rayPos.z - iz

    let tMaxX = dx === 0 ? Infinity : (dx > 0 ? (1 - ox) : ox) / Math.abs(dx)
    let tMaxY = dy === 0 ? Infinity : (dy > 0 ? (1 - oy) : oy) / Math.abs(dy)
    let tMaxZ = dz === 0 ? Infinity : (dz > 0 ? (1 - oz) : oz) / Math.abs(dz)

    let lastIX = ix, lastIY = iy, lastIZ = iz

    while (Math.min(tMaxX, tMaxY, tMaxZ) < REACH) {
      // Advance to the next voxel boundary on the nearest axis
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        lastIX = ix; lastIY = iy; lastIZ = iz
        ix     += stepX
        tMaxX  += tDeltaX
      } else if (tMaxY < tMaxZ) {
        lastIX = ix; lastIY = iy; lastIZ = iz
        iy     += stepY
        tMaxY  += tDeltaY
      } else {
        lastIX = ix; lastIY = iy; lastIZ = iz
        iz     += stepZ
        tMaxZ  += tDeltaZ
      }

      const block = this.world.getBlockWorld(ix, iy, iz)
      if (block !== BLOCKS.AIR && block > 0) {
        return {
          hit:    { x: ix,     y: iy,     z: iz     },
          before: { x: lastIX, y: lastIY, z: lastIZ },
        }
      }
    }

    return null
  }

  breakBlock() {
    const result = this.raycast()
    if (result?.hit) {
      const { x, y, z } = result.hit
      this.world.setBlockWorld(x, y, z, BLOCKS.AIR)
    }
  }

  placeBlock() {
    const result = this.raycast()
    if (!result?.before) return

    const { x, y, z } = result.before

    // Don't place if any part of the target block overlaps the player AABB (#16)
    // Check: does [x, x+1] overlap [pos.x-w, pos.x+w], and same for z, and y in [pos.y, pos.y+height]?
    const hw = PLAYER_WIDTH / 2
    const overlapX = x + 1 > this.pos.x - hw && x < this.pos.x + hw
    const overlapZ = z + 1 > this.pos.z - hw && z < this.pos.z + hw
    const overlapY = y + 1 > this.pos.y       && y < this.pos.y + PLAYER_HEIGHT
    if (overlapX && overlapZ && overlapY) return

    this.world.setBlockWorld(x, y, z, this.selectedBlock)
  }
}
