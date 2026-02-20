import * as THREE from 'three'
import { Chunk, BLOCKS, CHUNK_SIZE } from './chunk.js'
import { generateChunk, getTerrainHeight } from './terrain.js'

const RENDER_DISTANCE = 4 // chunks in each direction

export class World {
  constructor(scene) {
    this.scene = scene
    this.chunks = new Map() // key: "cx,cz" -> Chunk
  }

  chunkKey(cx, cz) {
    return `${cx},${cz}`
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.chunkKey(cx, cz)) || null
  }

  loadChunk(cx, cz) {
    const key = this.chunkKey(cx, cz)
    if (this.chunks.has(key)) return
    const chunk = new Chunk(cx, cz)
    generateChunk(chunk)
    this.chunks.set(key, chunk)

    const neighborGetter = (wx, wy, wz) => this.getBlockWorld(wx, wy, wz)
    chunk.buildMesh(this.scene, neighborGetter)

    // Rebuild already-loaded neighbors so their border faces resolve correctly
    for (const [dx, dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const neighbor = this.getChunk(cx + dx, cz + dz)
      if (neighbor) neighbor.buildMesh(this.scene, neighborGetter)
    }
  }

  unloadChunk(cx, cz) {
    const key = this.chunkKey(cx, cz)
    const chunk = this.chunks.get(key)
    if (chunk) {
      chunk.disposeMesh(this.scene)
      this.chunks.delete(key)
    }
  }

  // Call this every frame with player's world position
  update(px, pz) {
    const pcx = Math.floor(px / CHUNK_SIZE)
    const pcz = Math.floor(pz / CHUNK_SIZE)

    // Load chunks in range
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        this.loadChunk(pcx + dx, pcz + dz)
      }
    }

    // Unload chunks out of range
    for (const [key, chunk] of this.chunks) {
      const distX = Math.abs(chunk.cx - pcx)
      const distZ = Math.abs(chunk.cz - pcz)
      if (distX > RENDER_DISTANCE + 1 || distZ > RENDER_DISTANCE + 1) {
        this.unloadChunk(chunk.cx, chunk.cz)
      }
    }
  }

  // Get a block at world coordinates
  getBlockWorld(wx, wy, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE)
    const cz = Math.floor(wz / CHUNK_SIZE)
    const chunk = this.getChunk(cx, cz)
    if (!chunk) return BLOCKS.AIR
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    return chunk.getBlock(lx, wy, lz)
  }

  // Set a block at world coordinates and rebuild affected chunk(s)
  setBlockWorld(wx, wy, wz, type) {
    const cx = Math.floor(wx / CHUNK_SIZE)
    const cz = Math.floor(wz / CHUNK_SIZE)
    const chunk = this.getChunk(cx, cz)
    if (!chunk) return
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    chunk.setBlock(lx, wy, lz, type)

    // Always rebuild the chunk that was modified
    const neighborGetter = (wx, wy, wz) => this.getBlockWorld(wx, wy, wz)
    chunk.buildMesh(this.scene, neighborGetter)

    // If the block is on a chunk border, rebuild the neighboring chunk too
    // so its exposed faces stay in sync
    if (lx === 0) {
      const neighbor = this.getChunk(cx - 1, cz)
      if (neighbor) neighbor.buildMesh(this.scene, neighborGetter)
    } else if (lx === CHUNK_SIZE - 1) {
      const neighbor = this.getChunk(cx + 1, cz)
      if (neighbor) neighbor.buildMesh(this.scene, neighborGetter)
    }

    if (lz === 0) {
      const neighbor = this.getChunk(cx, cz - 1)
      if (neighbor) neighbor.buildMesh(this.scene, neighborGetter)
    } else if (lz === CHUNK_SIZE - 1) {
      const neighbor = this.getChunk(cx, cz + 1)
      if (neighbor) neighbor.buildMesh(this.scene, neighborGetter)
    }
  }

  // Get the surface height at a world x,z (used to spawn player)
  getSurfaceHeight(wx, wz) {
    return getTerrainHeight(wx, wz)
  }
}
