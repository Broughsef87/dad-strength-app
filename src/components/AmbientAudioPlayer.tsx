'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'

/**
 * All tracks generated via Web Audio API — no external URLs, no CORS,
 * works offline.
 *
 * Rain     → brown noise (integrated white noise) + low-pass filter
 * Forest   → pink noise (1/f noise) + gentle bandpass
 * White    → white noise (already well known)
 * Silence  → nothing
 */

const TRACKS = [
  { id: 'rain',       label: '🌧 Rain'       },
  { id: 'forest',     label: '🌲 Forest'     },
  { id: 'whitenoise', label: '🌬 White Noise' },
  { id: 'silence',    label: '🤫 Silence'    },
]

type SourceHandle = {
  stop: () => void
  setVolume: (v: number) => void
}

function makeBrownNoise(ctx: AudioContext, vol: number): SourceHandle {
  const bufferSize = ctx.sampleRate * 4
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let lastOut = 0
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1
    data[i] = (lastOut + 0.02 * white) / 1.02
    lastOut = data[i]
    data[i] *= 3.5
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  // Low-pass filter — softens it into rain rumble
  const lpf = ctx.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = 400

  const gain = ctx.createGain()
  gain.gain.value = vol

  source.connect(lpf)
  lpf.connect(gain)
  gain.connect(ctx.destination)
  source.start()

  return {
    stop: () => { try { source.stop() } catch {} },
    setVolume: (v) => { gain.gain.value = v },
  }
}

function makePinkNoise(ctx: AudioContext, vol: number): SourceHandle {
  const bufferSize = ctx.sampleRate * 4
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  // Paul Kellet's pink noise approximation
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < bufferSize; i++) {
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
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  // Gentle bandpass — shapes it into soft forest ambience
  const bpf = ctx.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.value = 800
  bpf.Q.value = 0.3

  const gain = ctx.createGain()
  gain.gain.value = vol

  source.connect(bpf)
  bpf.connect(gain)
  gain.connect(ctx.destination)
  source.start()

  return {
    stop: () => { try { source.stop() } catch {} },
    setVolume: (v) => { gain.gain.value = v },
  }
}

function makeWhiteNoise(ctx: AudioContext, vol: number): SourceHandle {
  const bufferSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const gain = ctx.createGain()
  gain.gain.value = vol
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
  return {
    stop: () => { try { source.stop() } catch {} },
    setVolume: (v) => { gain.gain.value = v },
  }
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

  const startTrack = (trackId: string, vol: number) => {
    stopCurrent()
    if (trackId === 'silence') return
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext()
    }
    const ctx = ctxRef.current
    // Resume suspended context (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume()
    if (trackId === 'rain')       handleRef.current = makeBrownNoise(ctx, vol)
    if (trackId === 'forest')     handleRef.current = makePinkNoise(ctx, vol)
    if (trackId === 'whitenoise') handleRef.current = makeWhiteNoise(ctx, vol)
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
      startTrack(activeTrack, volume)
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
