import * as THREE from 'three'

export const CHUNK_SIZE = 16
export const CHUNK_HEIGHT = 64

// Block type IDs
export const BLOCKS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  WATER: 7,
}

// Which blocks are transparent/passable for face culling purposes
const TRANSPARENT = new Set([BLOCKS.AIR, BLOCKS.WATER])

// Colors for each block type
const BLOCK_COLORS = {
  [BLOCKS.GRASS]:  { top: 0x5a9e32, side: 0x7a5c3a, bottom: 0x7a5c3a },
  [BLOCKS.DIRT]:   { top: 0x7a5c3a, side: 0x7a5c3a, bottom: 0x7a5c3a },
  [BLOCKS.STONE]:  { top: 0x888888, side: 0x888888, bottom: 0x888888 },
  [BLOCKS.WOOD]:   { top: 0x5c4a1e, side: 0x5c4a1e, bottom: 0x5c4a1e },
  [BLOCKS.LEAVES]: { top: 0x2d6e1e, side: 0x2d6e1e, bottom: 0x2d6e1e },
  [BLOCKS.SAND]:   { top: 0xe2d98a, side: 0xe2d98a, bottom: 0xe2d98a },
  [BLOCKS.WATER]:  { top: 0x3a7ecc, side: 0x3a7ecc, bottom: 0x3a7ecc },
}

const FACES = [
  { dir: [ 0,  1,  0], corners: [[0,1,0],[1,1,0],[0,1,1],[1,1,1]], face: 'top'    },
  { dir: [ 0, -1,  0], corners: [[1,0,0],[0,0,0],[1,0,1],[0,0,1]], face: 'bottom' },
  { dir: [-1,  0,  0], corners: [[0,0,0],[0,1,0],[0,0,1],[0,1,1]], face: 'sideX'  },
  { dir: [ 1,  0,  0], corners: [[1,1,0],[1,0,0],[1,1,1],[1,0,1]], face: 'sideX'  },
  { dir: [ 0,  0, -1], corners: [[1,0,0],[1,1,0],[0,0,0],[0,1,0]], face: 'sideZ'  },
  { dir: [ 0,  0,  1], corners: [[0,0,1],[0,1,1],[1,0,1],[1,1,1]], face: 'sideZ'  },
]

const FACE_SHADE = {
  top:    1.0,
  sideZ:  0.6,
  sideX:  0.5,
  bottom: 0.3,
}

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx
    this.cz = cz
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    this.mesh = null
    this.waterMesh = null
  }

  index(x, y, z) {
    return x + CHUNK_SIZE * (y + CHUNK_HEIGHT * z)
  }

  getBlock(x, y, z) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE)
      return -1
    return this.data[this.index(x, y, z)]
  }

  setBlock(x, y, z, type) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE)
      return
    this.data[this.index(x, y, z)] = type
  }

  buildMesh(scene, getNeighborBlock) {
    // Dispose old meshes
    if (this.mesh) {
      scene.remove(this.mesh)
      this.mesh.geometry.dispose()
      this.mesh = null
    }
    if (this.waterMesh) {
      scene.remove(this.waterMesh)
      this.waterMesh.geometry.dispose()
      this.waterMesh = null
    }

    // Opaque geometry arrays
    const positions = []
    const colors = []
    const indices = []
    let vertCount = 0

    // Water geometry arrays
    const wPositions = []
    const wColors = []
    const wIndices = []
    let wVertCount = 0

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const block = this.getBlock(x, y, z)
          if (block === BLOCKS.AIR) continue

          const isWater = block === BLOCKS.WATER
          const blockColors = BLOCK_COLORS[block] || BLOCK_COLORS[BLOCKS.STONE]

          for (const { dir, corners, face } of FACES) {
            const nx = x + dir[0]
            const ny = y + dir[1]
            const nz = z + dir[2]

            let neighbor
            if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) {
              neighbor = getNeighborBlock(
                this.cx * CHUNK_SIZE + nx,
                ny,
                this.cz * CHUNK_SIZE + nz
              )
            } else {
              neighbor = this.getBlock(nx, ny, nz)
            }

            // For opaque blocks: cull if neighbor is any non-transparent block
            // For water: only show face if neighbor is air (not other water)
            if (isWater) {
              // Only show water face if neighbor is truly air — not unloaded (-1) or other water
              if (neighbor !== BLOCKS.AIR) continue
            } else {
              if (!TRANSPARENT.has(neighbor) && neighbor !== -1) continue
            }

            const colorSlot = (face === 'sideX' || face === 'sideZ') ? 'side' : face
            const colorHex = blockColors[colorSlot]
            const r = ((colorHex >> 16) & 255) / 255
            const g = ((colorHex >> 8)  & 255) / 255
            const b = ((colorHex)       & 255) / 255
            const shade = FACE_SHADE[face]

            if (isWater) {
              for (const [cx, cy, cz] of corners) {
                wPositions.push(
                  this.cx * CHUNK_SIZE + x + cx,
                  y + cy,
                  this.cz * CHUNK_SIZE + z + cz
                )
                wColors.push(r * shade, g * shade, b * shade)
              }
              wIndices.push(
                wVertCount,     wVertCount + 2, wVertCount + 1,
                wVertCount + 1, wVertCount + 2, wVertCount + 3
              )
              wVertCount += 4
            } else {
              for (const [cx, cy, cz] of corners) {
                positions.push(
                  this.cx * CHUNK_SIZE + x + cx,
                  y + cy,
                  this.cz * CHUNK_SIZE + z + cz
                )
                colors.push(r * shade, g * shade, b * shade)
              }
              indices.push(
                vertCount,     vertCount + 2, vertCount + 1,
                vertCount + 1, vertCount + 2, vertCount + 3
              )
              vertCount += 4
            }
          }
        }
      }
    }

    // Build opaque mesh
    if (vertCount > 0) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()

      const material = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true })
      this.mesh = new THREE.Mesh(geometry, material)
      scene.add(this.mesh)
    }

    // Build water mesh
    if (wVertCount > 0) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(wPositions, 3))
      geometry.setAttribute('color',    new THREE.Float32BufferAttribute(wColors, 3))
      geometry.setIndex(wIndices)
      geometry.computeVertexNormals()

      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        fog: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false, // prevents water from blocking things behind it in the depth buffer
        side: THREE.DoubleSide, // visible from underwater too
      })
      this.waterMesh = new THREE.Mesh(geometry, material)
      scene.add(this.waterMesh)
    }
  }

  disposeMesh(scene) {
    if (this.mesh) {
      scene.remove(this.mesh)
      this.mesh.geometry.dispose()
      this.mesh = null
    }
    if (this.waterMesh) {
      scene.remove(this.waterMesh)
      this.waterMesh.geometry.dispose()
      this.waterMesh = null
    }
  }
}
