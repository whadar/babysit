export const THEME = {
  bg: '#1a0000',
  grid: '#2a0808',
  food: '#4ade80',
  headColor: '#ff4444',
  snakeHue: 0,
  font: 'bold 32px "Press Start 2P"',
  scoreFont: '14px "Press Start 2P"',
}

export const TICK = 80

export function draw(ctx, canvas, COLS, ROWS, CELL, snake, food, dead, paused, score) {
  ctx.fillStyle = THEME.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = THEME.grid
  ctx.lineWidth = 0.5
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke()
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke()
  }

  ctx.fillStyle = THEME.food
  ctx.beginPath()
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2)
  ctx.fill()

  snake.forEach((seg, i) => {
    const t = i / snake.length
    ctx.fillStyle = i === 0 ? THEME.headColor : `hsl(${THEME.snakeHue}, 80%, ${50 - t * 20}%)`
    const pad = i === 0 ? 1 : 2
    ctx.beginPath()
    ctx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, i === 0 ? 4 : 3)
    ctx.fill()
  })

  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = THEME.headColor
    ctx.font = THEME.font
    ctx.textAlign = 'center'
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2)
  }

  if (dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = THEME.headColor
    ctx.font = THEME.font
    ctx.textAlign = 'center'
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2)
    ctx.font = THEME.scoreFont
    ctx.fillStyle = '#cc6666'
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 30)
  }
}
