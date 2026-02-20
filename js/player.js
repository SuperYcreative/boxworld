import * as THREE from 'three'
import { BLOCKS, CHUNK_SIZE } from './chunk.js'

const GRAVITY = -28
const JUMP_FORCE = 10
const MOVE_SPEED = 6
const PLAYER_HEIGHT = 1.7
const PLAYER_WIDTH = 0.4
const REACH = 5 // how far you can break/place blocks

export class Player {
  constructor(camera, world) {
    this.camera = camera
    this.world = world

    this.pos = new THREE.Vector3(0, 40, 0) // will be set properly on spawn
    this.vel = new THREE.Vector3(0, 0, 0)
    this.onGround = false

    this.yaw = 0   // left/right look
    this.pitch = 0 // up/down look

    this.selectedBlock = BLOCKS.GRASS // block to place

    this.keys = {}
    this.initControls()
  }

  initControls() {
    document.addEventListener('keydown', e => { this.keys[e.code] = true })
    document.addEventListener('keyup',   e => { this.keys[e.code] = false })

    // Mouse look
    document.addEventListener('mousemove', e => {
      if (!document.pointerLockElement) return
      this.yaw   -= e.movementX * 0.002
      this.pitch -= e.movementY * 0.002
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch))
    })

    // Break block (left click)
    document.addEventListener('mousedown', e => {
      if (!document.pointerLockElement) return
      if (e.button === 0) this.breakBlock()
      if (e.button === 2) this.placeBlock()
    })

    // Prevent context menu on right click
    document.addEventListener('contextmenu', e => e.preventDefault())

    // Number keys to select block type
    document.addEventListener('keydown', e => {
      const map = {
        Digit1: BLOCKS.GRASS,
        Digit2: BLOCKS.DIRT,
        Digit3: BLOCKS.STONE,
        Digit4: BLOCKS.WOOD,
        Digit5: BLOCKS.LEAVES,
        Digit6: BLOCKS.SAND,
      }
      if (map[e.code]) this.selectedBlock = map[e.code]
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

  handleMovement(dt) {
    // Get forward/right vectors (ignore vertical component)
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw), 0, -Math.cos(this.yaw)
    )
    const right = new THREE.Vector3(
      Math.cos(this.yaw), 0, -Math.sin(this.yaw)
    )

    const move = new THREE.Vector3()
    if (this.keys['KeyW']) move.add(forward)
    if (this.keys['KeyS']) move.sub(forward)
    if (this.keys['KeyA']) move.sub(right)
    if (this.keys['KeyD']) move.add(right)

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(MOVE_SPEED)
    }

    this.vel.x = move.x
    this.vel.z = move.z

    if (this.keys['Space'] && this.onGround) {
      this.vel.y = JUMP_FORCE
      this.onGround = false
    }
  }

  applyPhysics(dt) {
    // Gravity
    this.vel.y += GRAVITY * dt

    // Move and collide each axis separately
    this.pos.x += this.vel.x * dt
    this.collideAxis('x')

    this.pos.y += this.vel.y * dt
    this.collideAxis('y')

    this.pos.z += this.vel.z * dt
    this.collideAxis('z')
  }

  collideAxis(axis) {
    const w = PLAYER_WIDTH / 2
    const offsets = []

    if (axis === 'y') {
      // Check feet and head
      offsets.push(
        [0, 0, 0],
        [0, PLAYER_HEIGHT, 0]
      )
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
      const bx = Math.floor(this.pos.x + ox)
      const by = Math.floor(this.pos.y + oy)
      const bz = Math.floor(this.pos.z + oz)
      const block = this.world.getBlockWorld(bx, by, bz)

      if (block !== BLOCKS.AIR && block !== BLOCKS.WATER && block > 0) {
        if (axis === 'y') {
          if (this.vel.y < 0) {
            this.pos.y = by + 1
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

    // If moving down and no collision, not on ground
    if (axis === 'y' && this.vel.y !== 0) this.onGround = false
  }

  // Raycast into the world to find which block the player is looking at
  raycast() {
    const dir = new THREE.Vector3(0, 0, -1)
    dir.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'))

    const pos = this.camera.position.clone()
    const step = 0.05

    let lastEmpty = null

    for (let dist = 0; dist < REACH; dist += step) {
      const bx = Math.floor(pos.x)
      const by = Math.floor(pos.y)
      const bz = Math.floor(pos.z)
      const block = this.world.getBlockWorld(bx, by, bz)

      if (block !== BLOCKS.AIR && block > 0) {
        return { hit: { x: bx, y: by, z: bz }, before: lastEmpty }
      }

      lastEmpty = { x: bx, y: by, z: bz }
      pos.addScaledVector(dir, step)
    }

    return null
  }

  breakBlock() {
    const result = this.raycast()
    if (result && result.hit) {
      const { x, y, z } = result.hit
      this.world.setBlockWorld(x, y, z, BLOCKS.AIR)
    }
  }

  placeBlock() {
    const result = this.raycast()
    if (result && result.before) {
      const { x, y, z } = result.before
      // Don't place inside the player
      const px = Math.floor(this.pos.x)
      const py = Math.floor(this.pos.y)
      const pz = Math.floor(this.pos.z)
      if (x === px && z === pz && (y === py || y === py + 1)) return
      this.world.setBlockWorld(x, y, z, this.selectedBlock)
    }
  }
}
