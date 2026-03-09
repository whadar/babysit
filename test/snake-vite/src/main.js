import './style.css'
import { draw as _draw, TICK as _TICK } from './draw.js'
import { startMusic, toggleMusic } from './music.js'

const CELL = 22
const COLS = 24
const ROWS = 24

let drawFn = _draw
let TICK = _TICK

const canvas = document.getElementById('c')
canvas.width = COLS * CELL
canvas.height = ROWS * CELL
const ctx = canvas.getContext('2d')

const msg = document.getElementById('msg')

let snake, dir, nextDir, food, score, highScore, running, dead, paused

function init() {
  snake = [{ x: 10, y: 10 }]
  dir = { x: 1, y: 0 }
  nextDir = { x: 1, y: 0 }
  score = 0
  dead = false
  paused = false
  running = true
  placeFood()
  updateHUD()
  msg.textContent = 'Arrow keys or WASD to move'
}

function placeFood() {
  let pos
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
  } while (snake.some(s => s.x === pos.x && s.y === pos.y))
  food = pos
}

function step() {
  if (!running || paused) return
  dir = nextDir
  const head = {
    x: (snake[0].x + dir.x + COLS) % COLS,
    y: (snake[0].y + dir.y + ROWS) % ROWS,
  }
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    die(); return
  }
  snake.unshift(head)
  if (head.x === food.x && head.y === food.y) {
    score++
    if (score > (highScore || 0)) highScore = score
    placeFood()
    updateHUD()
  } else {
    snake.pop()
  }
}

function die() {
  running = false
  dead = true
  msg.textContent = 'Game over — press Space to restart'
}

function updateHUD() {
  document.getElementById('score').textContent = score
  document.getElementById('high').textContent = highScore || 0
}

function draw() {
  drawFn(ctx, canvas, COLS, ROWS, CELL, snake, food, dead, paused, score)
}

document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if (e.key === ' ' && dead) { init(); startMusic(); return }
  if (e.key === ' ' && running) {
    paused = !paused
    msg.textContent = paused ? 'Paused — press Space to resume' : 'Arrow keys or WASD to move'
    return
  }
  if (e.key === 'm' || e.key === 'M') { toggleMusic(); return }

  const map = {
    ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 }, s: { x: 0, y: 1 },
    a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
  }
  const d = map[e.key]
  if (d) { e.preventDefault(); startMusic(); if (d.x !== -dir.x || d.y !== -dir.y) nextDir = d }
})

window.__snakeState = () => ({ score, highScore, snakeLength: snake.length, direction: dir, dead })

init()

let last = 0
function loop(ts) {
  if (ts - last >= TICK) { step(); last = ts }
  draw()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

function loadWidget() {
  document.getElementById('__babysit_script')?.remove()
  delete window.Babysit
  const s = document.createElement('script')
  s.id = '__babysit_script'
  s.src = 'http://localhost:5678/widget.js?' + Date.now()
  s.onload = () => {
    if (window.Babysit) {
      Babysit.init({
        trigger: '/',
        server: 'http://localhost:5678',
        repo: 'whadar/babysit',
        position: 'bottom',
        autoOpen: true,
        button: true,
        context: () => window.__snakeState?.() ?? {},
      })
      console.log('[babysit] widget ready')
    }
  }
  s.onerror = () => console.warn('[babysit] widget failed to load — is the server running on :5678?')
  document.body.appendChild(s)
}

loadWidget()

if (import.meta.hot) {
  import.meta.hot.accept('./draw.js', (newModule) => {
    drawFn = newModule.draw
    TICK = newModule.TICK
  })
  import.meta.hot.dispose(() => {
    document.getElementById('__babysit_script')?.remove()
    delete window.Babysit
  })
  import.meta.hot.accept()
}
