import * as THREE from 'three'
import { World } from './world.js'
import { Player } from './player.js'

// --- Scene setup ---
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87CEEB) // sky blue
scene.fog = new THREE.Fog(0x87CEEB, 60, 120)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
// Shadow map disabled — face shading handles all depth cues
renderer.shadowMap.enabled = false
document.body.appendChild(renderer.domElement)

// --- Lighting ---
// Ambient light only — face shading in chunk.js replaces directional shadow work
const ambient = new THREE.AmbientLight(0xffffff, 1.0)
scene.add(ambient)

// --- Underwater overlay ---
const underwaterOverlay = document.createElement('div')
underwaterOverlay.style.cssText = `
  position: fixed; inset: 0;
  background: rgba(10, 40, 80, 0.45);
  pointer-events: none;
  display: none;
`
document.body.appendChild(underwaterOverlay)

const SKY_COLOR = new THREE.Color(0x87CEEB)
const WATER_COLOR = new THREE.Color(0x0a2850)
let wasUnderwater = false

// --- World & Player ---
const world = new World(scene)
const player = new Player(camera, world)

// Spawn player — do an initial world load first so terrain height is available
const spawnCX = 0, spawnCZ = 0
for (let dx = -2; dx <= 2; dx++) {
  for (let dz = -2; dz <= 2; dz++) {
    world.loadChunk(spawnCX + dx, spawnCZ + dz)
  }
}
player.spawn()

// --- Pointer lock (click to play) ---
const blocker = document.getElementById('blocker')

blocker.addEventListener('click', () => {
  document.body.requestPointerLock()
})

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) {
    blocker.style.display = 'none'
  } else {
    blocker.style.display = 'flex'
  }
})

// --- Handle window resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// --- Game loop ---
let lastTime = performance.now()

function gameLoop() {
  requestAnimationFrame(gameLoop)

  const now = performance.now()
  const dt = Math.min((now - lastTime) / 1000, 0.05) // cap dt to avoid huge jumps
  lastTime = now

  player.update(dt)
  world.update(player.pos.x, player.pos.z)

  // Underwater tint — check if camera is inside a water block
  const camBlock = world.getBlockWorld(
    Math.floor(camera.position.x),
    Math.floor(camera.position.y),
    Math.floor(camera.position.z)
  )
  const underwater = camBlock === 7 // BLOCKS.WATER
  if (underwater !== wasUnderwater) {
    underwaterOverlay.style.display = underwater ? 'block' : 'none'
    scene.background = underwater ? WATER_COLOR : SKY_COLOR
    scene.fog.color = underwater ? WATER_COLOR : SKY_COLOR
    scene.fog.near = underwater ? 4 : 60
    scene.fog.far = underwater ? 20 : 120
    wasUnderwater = underwater
  }

  renderer.render(scene, camera)
}

gameLoop()
