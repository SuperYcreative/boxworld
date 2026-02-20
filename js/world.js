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
    chunk.buildMesh(this.scene, (wx, wy, wz) => this.getBlockWorld(wx, wy, wz))
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

  // Set a block at world coordinates and rebuild affected chunk
  setBlockWorld(wx, wy, wz, type) {
    const cx = Math.floor(wx / CHUNK_SIZE)
    const cz = Math.floor(wz / CHUNK_SIZE)
    const chunk = this.getChunk(cx, cz)
    if (!chunk) return
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    chunk.setBlock(lx, wy, lz, type)
    chunk.buildMesh(this.scene, (wx, wy, wz) => this.getBlockWorld(wx, wy, wz))
  }

  // Get the surface height at a world x,z (used to spawn player)
  getSurfaceHeight(wx, wz) {
    return getTerrainHeight(wx, wz)
  }
}
