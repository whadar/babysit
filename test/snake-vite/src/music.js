const BPM = 160
const BEAT = 60 / BPM

// Simple pentatonic melody loop (note frequencies in Hz)
const MELODY = [
  220, 261.63, 293.66, 349.23, 392,
  440, 392, 349.23, 293.66, 261.63,
  220, 261.63, 349.23, 440, 392, 293.66,
]

let ctx, gainNode, playing = false, stopFns = []

function getCtx() {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function playNote(ac, freq, start, duration, vol = 0.08) {
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  g.gain.setValueAtTime(vol, start)
  g.gain.linearRampToValueAtTime(0, start + duration * 0.9)
  osc.connect(g)
  g.connect(gainNode)
  osc.start(start)
  osc.stop(start + duration)
  return osc
}

function scheduleMelody(ac, startTime) {
  const oscs = []
  MELODY.forEach((freq, i) => {
    oscs.push(playNote(ac, freq, startTime + i * BEAT, BEAT))
    // octave below for bass every 2 beats
    if (i % 2 === 0) {
      oscs.push(playNote(ac, freq / 2, startTime + i * BEAT, BEAT * 2, 0.05))
    }
  })
  return MELODY.length * BEAT
}

export function startMusic() {
  if (playing) return
  playing = true
  const ac = getCtx()
  if (ac.state === 'suspended') ac.resume()

  gainNode = ac.createGain()
  gainNode.gain.value = 1
  gainNode.connect(ac.destination)

  let loopStart = ac.currentTime + 0.1
  let loopDuration = 0

  function scheduleLoop() {
    if (!playing) return
    loopDuration = scheduleMelody(ac, loopStart)
    const nextStart = loopStart + loopDuration
    const delay = (nextStart - ac.currentTime - 0.2) * 1000
    const tid = setTimeout(() => {
      loopStart = nextStart
      scheduleLoop()
    }, Math.max(0, delay))
    stopFns.push(() => clearTimeout(tid))
  }

  scheduleLoop()
}

export function stopMusic() {
  playing = false
  stopFns.forEach(fn => fn())
  stopFns = []
  if (gainNode) {
    gainNode.gain.linearRampToValueAtTime(0, getCtx().currentTime + 0.3)
  }
}

export function toggleMusic() {
  playing ? stopMusic() : startMusic()
  return playing
}
