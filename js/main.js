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
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

// --- Lighting ---
const ambient = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambient)

const sun = new THREE.DirectionalLight(0xfffbe0, 1.2)
sun.position.set(100, 200, 100)
sun.castShadow = true
sun.shadow.mapSize.width = 2048
sun.shadow.mapSize.height = 2048
sun.shadow.camera.near = 0.5
sun.shadow.camera.far = 500
sun.shadow.camera.left = -100
sun.shadow.camera.right = 100
sun.shadow.camera.top = 100
sun.shadow.camera.bottom = -100
scene.add(sun)

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

  renderer.render(scene, camera)
}

gameLoop()
```

---

That's all the files! Here's a checklist of everything you should have:
```
index.html
js/
  main.js
  noise.js
  chunk.js
  terrain.js
  world.js
  player.js
