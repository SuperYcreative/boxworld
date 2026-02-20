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

  // Trunk — clamp to chunk bounds on X/Z, clamp top to CHUNK_HEIGHT
  for (let i = 0; i < trunkHeight; i++) {
    if (y + i >= CHUNK_HEIGHT) break
    // Trunk is always at the tree's own x,z — no offset, always in bounds
    chunk.setBlock(x, y + i, z, BLOCKS.WOOD)
  }

  // Leaves — clamp each write to chunk bounds so border trees don't get silently clipped
  const top = y + trunkHeight
  for (let dy = -1; dy <= 2; dy++) {
    const ly = top + dy
    if (ly < 0 || ly >= CHUNK_HEIGHT) continue

    // Determine leaf radius for this layer
    const isTopCap = dy === 2
    const radius = isTopCap ? 0 : 2

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        // Trim corners on the wide layers
        if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue

        const lx = x + dx
        const lz = z + dz

        // Only write if within this chunk's bounds
        if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue

        chunk.setBlock(lx, ly, lz, BLOCKS.LEAVES)
      }
    }
  }
}

export { getTerrainHeight }
