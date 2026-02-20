import { BLOCKS, CHUNK_SIZE, CHUNK_HEIGHT } from './chunk.js'
import { SimplexNoise } from './noise.js'

const noise = new SimplexNoise(42) // change 42 to any number for a different world

const SEA_LEVEL = 12
const STONE_DEPTH = 4 // how many blocks of dirt before stone

function treeAt(wx, wz) {
  // Deterministic: only place a tree at certain world positions
  const h = Math.abs(Math.sin(wx * 127.1 + wz * 311.7) * 43758.5) % 1
  return h > 0.92
}

function getTerrainHeight(wx, wz) {
  // Base continent shape
  const base = noise.octaves(wx, wz, 4, 0.5, 0.004) // large scale hills
  const detail = noise.octaves(wx, wz, 2, 0.5, 0.02) // small detail
  const height = Math.floor(SEA_LEVEL + base * 20 + detail * 5)
  return Math.max(1, Math.min(height, CHUNK_HEIGHT - 10))
}

export function generateChunk(chunk) {
  const { cx, cz } = chunk

  // First pass: terrain
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = cx * CHUNK_SIZE + x
      const wz = cz * CHUNK_SIZE + z
      const terrainH = getTerrainHeight(wx, wz)

      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        let block = BLOCKS.AIR

        if (y === 0) {
          block = BLOCKS.STONE // bedrock layer
        } else if (y < terrainH - STONE_DEPTH) {
          block = BLOCKS.STONE
        } else if (y < terrainH) {
          block = BLOCKS.DIRT
        } else if (y === terrainH) {
          if (terrainH <= SEA_LEVEL + 1) {
            block = BLOCKS.SAND  // beach
          } else {
            block = BLOCKS.GRASS
          }
        } else if (y <= SEA_LEVEL && block === BLOCKS.AIR) {
          block = BLOCKS.WATER
        }

        chunk.setBlock(x, y, z, block)
      }
    }
  }

  // Second pass: trees (only on grass, away from water)
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = cx * CHUNK_SIZE + x
      const wz = cz * CHUNK_SIZE + z
      const terrainH = getTerrainHeight(wx, wz)

      if (terrainH > SEA_LEVEL + 2 && treeAt(wx, wz)) {
        placeTree(chunk, x, terrainH + 1, z)
      }
    }
  }
}

function placeTree(chunk, x, y, z) {
  const trunkHeight = 4

  // Trunk
  for (let i = 0; i < trunkHeight; i++) {
    chunk.setBlock(x, y + i, z, BLOCKS.WOOD)
  }

  // Leaves (a simple 3x3x3 blob at the top, plus a top cap)
  const top = y + trunkHeight
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue // trim corners
        chunk.setBlock(x + dx, top + dy, z + dz, BLOCKS.LEAVES)
      }
    }
  }
  // Top cap
  chunk.setBlock(x, top + 2, z, BLOCKS.LEAVES)
}

export { getTerrainHeight }
