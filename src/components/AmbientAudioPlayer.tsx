'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'

/**
 * All tracks generated via the Web Audio API — no external URLs, no CORS,
 * works offline. Beyond flat noise, the nature/zen beds layer continuous
 * filtered noise with *scheduled* one-shot events (birdsong, water bloops,
 * koto plucks, a temple bell) for texture that doesn't read as white noise.
 *
 *   Rain    → brown noise + low-pass rumble
 *   Forest  → breathing wind bed + faint canopy rustle + sparse birdsong
 *   Stream  → sweeping water bed + rushing hiss + steady bubbling bloops
 *   Zen     → detuned drone (root/fifth/octave) + koto plucks + temple bell
 *   White   → flat white noise
 *   Silence → nothing
 */

const TRACKS = [
  { id: 'rain',       label: '🌧 Rain'    },
  { id: 'forest',     label: '🌲 Forest'  },
  { id: 'stream',     label: '💧 Stream'  },
  { id: 'zen',        label: '☯ Zen'      },
  { id: 'whitenoise', label: '🌬 White'   },
  { id: 'silence',    label: '🤫 Silence' },
]

type SourceHandle = {
  stop: () => void
  setVolume: (v: number) => void
}

// ── helpers ──────────────────────────────────────────────────────────────────
const rand = (min: number, max: number) => min + Math.random() * (max - min)

function fillNoise(ctx: AudioContext, seconds: number, kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  if (kind === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  } else if (kind === 'brown') {
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
  } else {
    // pink — Paul Kellet approximation
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    }
  }
  return buffer
}

// A rig owns one master gain + tracks every continuous voice and timer so a
// single stop() tears the whole track down cleanly.
type Rig = {
  ctx: AudioContext
  master: GainNode
  voices: AudioScheduledSourceNode[]
  isStopped: () => boolean
  every: (firstMin: number, firstMax: number, min: number, max: number, fn: () => void) => void
  handle: SourceHandle
}

function createRig(ctx: AudioContext, vol: number): Rig {
  const master = ctx.createGain()
  master.gain.value = vol
  master.connect(ctx.destination)
  const voices: AudioScheduledSourceNode[] = []
  const timers: ReturnType<typeof setTimeout>[] = []
  let stopped = false

  const every: Rig['every'] = (firstMin, firstMax, min, max, fn) => {
    const tick = () => {
      if (stopped) return
      fn()
      timers.push(setTimeout(tick, rand(min, max)))
    }
    timers.push(setTimeout(tick, rand(firstMin, firstMax)))
  }

  return {
    ctx, master, voices, every,
    isStopped: () => stopped,
    handle: {
      stop: () => {
        stopped = true
        timers.forEach(t => clearTimeout(t))
        voices.forEach(v => { try { v.stop() } catch {} })
        try { master.disconnect() } catch {}
      },
      setVolume: (v) => { master.gain.value = v },
    },
  }
}

// A continuous, looping noise bed feeding a filter chain into the master.
function noiseBed(rig: Rig, kind: 'white' | 'pink' | 'brown', nodes: AudioNode[], gain: number): void {
  const src = rig.ctx.createBufferSource()
  src.buffer = fillNoise(rig.ctx, 4, kind)
  src.loop = true
  const g = rig.ctx.createGain()
  g.gain.value = gain
  let node: AudioNode = src
  for (const n of nodes) { node.connect(n); node = n }
  node.connect(g)
  g.connect(rig.master)
  src.start()
  rig.voices.push(src)
}

// Slow LFO modulating an AudioParam (breathing filters, tremolo).
function lfo(rig: Rig, freq: number, depth: number, target: AudioParam): void {
  const osc = rig.ctx.createOscillator()
  osc.frequency.value = freq
  const g = rig.ctx.createGain()
  g.gain.value = depth
  osc.connect(g)
  g.connect(target)
  osc.start()
  rig.voices.push(osc)
}

// ── one-shot events ──────────────────────────────────────────────────────────
function birdChirp(rig: Rig): void {
  const { ctx, master } = rig
  const now = ctx.currentTime
  const base = rand(1900, 3800)
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(base, now)
  o.frequency.linearRampToValueAtTime(base * 1.18, now + 0.04)
  o.frequency.linearRampToValueAtTime(base * 0.95, now + 0.09)
  o.frequency.linearRampToValueAtTime(base * 1.10, now + 0.14)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(rand(0.04, 0.10), now + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0006, now + 0.22)
  o.connect(g); g.connect(master)
  o.start(now); o.stop(now + 0.26)
}

function waterBloop(rig: Rig): void {
  const { ctx, master } = rig
  const now = ctx.currentTime
  const f0 = rand(600, 1900)
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(f0, now)
  o.frequency.exponentialRampToValueAtTime(f0 * 0.5, now + 0.08)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(rand(0.025, 0.07), now + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0004, now + 0.09)
  o.connect(g); g.connect(master)
  o.start(now); o.stop(now + 0.12)
}

const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25] // C D E G A C, koto-ish
function kotoPluck(rig: Rig): void {
  const { ctx, master } = rig
  const now = ctx.currentTime
  const freq = PENTATONIC[Math.floor(rand(0, PENTATONIC.length))]
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.value = freq
  const vib = ctx.createOscillator()
  vib.frequency.value = 5.5
  const vibG = ctx.createGain()
  vibG.gain.value = freq * 0.006
  vib.connect(vibG); vibG.connect(o.frequency)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(0.13, now + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0004, now + 1.6)
  o.connect(g); g.connect(master)
  vib.start(now); vib.stop(now + 1.7)
  o.start(now); o.stop(now + 1.7)
}

// Temple-bell / singing-bowl strike: inharmonic partials with long decays.
function templeBell(rig: Rig, fundamental: number): void {
  const { ctx, master } = rig
  const now = ctx.currentTime
  const partials = [
    { r: 1.00, d: 6.0, g: 0.16 },
    { r: 2.00, d: 5.0, g: 0.10 },
    { r: 2.74, d: 4.0, g: 0.07 },
    { r: 3.00, d: 3.2, g: 0.05 },
    { r: 4.50, d: 2.4, g: 0.03 },
    { r: 5.43, d: 1.8, g: 0.02 },
  ]
  for (const p of partials) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = fundamental * p.r
    // tiny detuned twin → shimmering beat, like a real bowl
    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.value = fundamental * p.r * 1.003
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(p.g, now + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0003, now + p.d)
    o.connect(g); o2.connect(g); g.connect(master)
    o.start(now);  o.stop(now + p.d + 0.1)
    o2.start(now); o2.stop(now + p.d + 0.1)
  }
}

// ── tracks ───────────────────────────────────────────────────────────────────
function makeRain(ctx: AudioContext, vol: number): SourceHandle {
  const rig = createRig(ctx, vol)
  const lpf = ctx.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = 400
  noiseBed(rig, 'brown', [lpf], 1)
  return rig.handle
}

function makeForest(ctx: AudioContext, vol: number): SourceHandle {
  const rig = createRig(ctx, vol)
  // Breathing wind: soft low pink bed with a slowly sweeping low-pass.
  const wind = ctx.createBiquadFilter()
  wind.type = 'lowpass'
  wind.frequency.value = 420
  wind.Q.value = 0.5
  noiseBed(rig, 'pink', [wind], 0.5)
  lfo(rig, 0.07, 170, wind.frequency) // 250–590 Hz swell
  // Faint high canopy rustle, gently amplitude-modulated.
  const leaves = ctx.createBiquadFilter()
  leaves.type = 'highpass'
  leaves.frequency.value = 3200
  const rustleGain = ctx.createGain()
  rustleGain.gain.value = 0.05
  const rustle = ctx.createBufferSource()
  rustle.buffer = fillNoise(ctx, 4, 'pink')
  rustle.loop = true
  rustle.connect(leaves); leaves.connect(rustleGain); rustleGain.connect(rig.master)
  rustle.start()
  rig.voices.push(rustle)
  lfo(rig, 0.15, 0.035, rustleGain.gain)
  // Sparse birdsong.
  rig.every(1200, 3000, 1800, 6500, () => {
    birdChirp(rig)
    if (Math.random() < 0.4) setTimeout(() => !rig.isStopped() && birdChirp(rig), rand(120, 260))
  })
  return rig.handle
}

function makeStream(ctx: AudioContext, vol: number): SourceHandle {
  const rig = createRig(ctx, vol)
  // Moving water body: brown bed through a sweeping band-pass.
  const body = ctx.createBiquadFilter()
  body.type = 'bandpass'
  body.frequency.value = 700
  body.Q.value = 0.7
  noiseBed(rig, 'brown', [body], 0.7)
  lfo(rig, 0.13, 320, body.frequency) // 380–1020 Hz churn
  // Rushing hiss on top.
  const rush = ctx.createBiquadFilter()
  rush.type = 'highpass'
  rush.frequency.value = 2600
  noiseBed(rig, 'white', [rush], 0.11)
  // Steady bubbling.
  rig.every(60, 200, 90, 360, () => waterBloop(rig))
  return rig.handle
}

function makeZen(ctx: AudioContext, vol: number): SourceHandle {
  const rig = createRig(ctx, vol)
  // Warm detuned drone: root + fifth + octave, each a lightly detuned pair.
  const droneGain = ctx.createGain()
  droneGain.gain.value = 0.5
  droneGain.connect(rig.master)
  const roots = [130.81, 196.00, 261.63] // C3 G3 C4
  for (const f of roots) {
    for (const cents of [-4, 4]) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f * Math.pow(2, cents / 1200)
      const g = ctx.createGain()
      g.gain.value = 0.05
      o.connect(g); g.connect(droneGain)
      o.start()
      rig.voices.push(o)
    }
  }
  lfo(rig, 0.08, 0.12, droneGain.gain) // slow tidal swell
  // Koto plucks and a periodic temple bell.
  rig.every(2500, 5000, 3000, 7000, () => kotoPluck(rig))
  rig.every(2000, 4000, 24000, 40000, () => templeBell(rig, 196.00))
  return rig.handle
}

function makeWhite(ctx: AudioContext, vol: number): SourceHandle {
  const rig = createRig(ctx, vol)
  noiseBed(rig, 'white', [], 1)
  return rig.handle
}

const MAKERS: Record<string, (ctx: AudioContext, vol: number) => SourceHandle> = {
  rain: makeRain,
  forest: makeForest,
  stream: makeStream,
  zen: makeZen,
  whitenoise: makeWhite,
}

export default function AmbientAudioPlayer() {
  const [activeTrack, setActiveTrack] = useState<string>('rain')
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const ctxRef = useRef<AudioContext | null>(null)
  const handleRef = useRef<SourceHandle | null>(null)

  const stopCurrent = () => {
    handleRef.current?.stop()
    handleRef.current = null
  }

  const startTrack = async (trackId: string, vol: number) => {
    stopCurrent()
    const maker = MAKERS[trackId]
    if (!maker) return // silence
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext()
    }
    const ctx = ctxRef.current
    // Must await resume — browsers suspend AudioContext until a user gesture
    // resolves. Calling source.start() before this silently does nothing.
    if (ctx.state === 'suspended') await ctx.resume()
    handleRef.current = maker(ctx, vol)
  }

  useEffect(() => {
    return () => {
      stopCurrent()
      ctxRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTrackSelect = (trackId: string) => {
    setActiveTrack(trackId)
    if (isPlaying) startTrack(trackId, volume)
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      stopCurrent()
      setIsPlaying(false)
    } else {
      void startTrack(activeTrack, volume)
      setIsPlaying(true)
    }
  }

  const handleVolume = (val: number) => {
    setVolume(val)
    handleRef.current?.setVolume(val)
  }

  return (
    <div className="mt-4 rounded-2xl bg-card border border-border p-4 space-y-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-black">Ambient Sound</p>

      {/* Track selector */}
      <div className="flex flex-wrap gap-2">
        {TRACKS.map(t => (
          <button
            key={t.id}
            onClick={() => handleTrackSelect(t.id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              activeTrack === t.id
                ? 'bg-brand text-foreground'
                : 'bg-muted text-muted-foreground hover:border-brand/30 hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={handlePlayPause}
          className="w-10 h-10 rounded-full bg-brand hover:bg-brand/90 flex items-center justify-center transition-colors"
        >
          {isPlaying
            ? <Pause className="w-4 h-4 text-foreground" />
            : <Play className="w-4 h-4 text-foreground ml-0.5" />
          }
        </button>

        <div className="flex items-center gap-2 flex-1">
          <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={e => handleVolume(parseFloat(e.target.value))}
            className="flex-1 accent-brand h-1.5 rounded-full cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}
