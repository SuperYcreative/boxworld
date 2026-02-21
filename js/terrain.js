import { BLOCKS, CHUNK_SIZE, CHUNK_HEIGHT } from './chunk.js'
import { PerlinNoise } from './noise.js'

const noise = new PerlinNoise(42) // change 42 to any number for a different world

const SEA_LEVEL = 12
const STONE_DEPTH = 4 // how many blocks of dirt before stone

// Deterministic tree check: returns true for ~8% of grass positions
function treeAt(wx, wz) {
  const h = Math.abs(Math.sin(wx * 127.1 + wz * 311.7) * 43758.5) % 1
  return h > 0.92
}

export function getTerrainHeight(wx, wz) {
  const base   = noise.octaves(wx, wz, 4, 0.5, 0.004) // large scale hills
  const detail = noise.octaves(wx, wz, 2, 0.5, 0.02)  // fine surface detail
  const height = Math.floor(SEA_LEVEL + base * 20 + detail * 5)
  return Math.max(1, Math.min(height, CHUNK_HEIGHT - 10))
}

export function generateChunk(chunk) {
  const { cx, cz } = chunk

  // Build a height cache so getTerrainHeight is called once per column, not twice
  const heights = new Int32Array(CHUNK_SIZE * CHUNK_SIZE)
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = cx * CHUNK_SIZE + x
      const wz = cz * CHUNK_SIZE + z
      heights[z * CHUNK_SIZE + x] = getTerrainHeight(wx, wz)
    }
  }

  // First pass: terrain blocks
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const terrainH = heights[z * CHUNK_SIZE + x]

      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        let block

        if (y === 0) {
          block = BLOCKS.STONE               // bedrock layer
        } else if (y < terrainH - STONE_DEPTH) {
          block = BLOCKS.STONE
        } else if (y < terrainH) {
          block = BLOCKS.DIRT
        } else if (y === terrainH) {
          block = terrainH <= SEA_LEVEL + 1 ? BLOCKS.SAND : BLOCKS.GRASS
        } else if (y <= SEA_LEVEL) {
          block = BLOCKS.WATER               // fill below sea level with water (fixed: no redundant AIR check)
        } else {
          block = BLOCKS.AIR
        }

        chunk.setBlock(x, y, z, block)
      }
    }
  }

  // Second pass: trees (reads from height cache, no recomputation)
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = cx * CHUNK_SIZE + x
      const wz = cz * CHUNK_SIZE + z
      const terrainH = heights[z * CHUNK_SIZE + x]

      if (terrainH > SEA_LEVEL + 2 && treeAt(wx, wz)) {
        placeTree(chunk, x, terrainH + 1, z)
      }
    }
  }
}

// Places a tree using local chunk coordinates.
// Leaf offsets that fall outside [0, CHUNK_SIZE) are skipped — cross-chunk
// leaves are handled correctly by not writing out-of-bounds data.
// (chunk.setBlock already guards bounds, so no corruption occurs.)
function placeTree(chunk, x, y, z) {
  const trunkHeight = 4

  // Trunk
  for (let i = 0; i < trunkHeight; i++) {
    chunk.setBlock(x, y + i, z, BLOCKS.WOOD)
  }

  // Leaf canopy: 5x5 for dy=-1..1, trimmed corners, plus a top cap
  const top = y + trunkHeight
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue // trim corners
        // Out-of-chunk writes are silently discarded by chunk.setBlock bounds check
        chunk.setBlock(x + dx, top + dy, z + dz, BLOCKS.LEAVES)
      }
    }
  }
  // Top cap
  chunk.setBlock(x, top + 2, z, BLOCKS.LEAVES)
}
