'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'

const TRACKS = [
  { id: 'rain', label: 'ðŸŒ§ Rain', url: 'https://www.soundjay.com/nature/sounds/rain-01.mp3' },
  { id: 'whitenoise', label: 'ðŸŒ¬ White Noise', url: null }, // generated via Web Audio API
  { id: 'forest', label: 'ðŸŒ² Forest', url: 'https://www.soundjay.com/nature/sounds/forest-ambience-1.mp3' },
  { id: 'silence', label: '🤫 Silence', url: 'silence' },
]

export default function AmbientAudioPlayer() {
  const [activeTrack, setActiveTrack] = useState<string>('rain')
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const whiteNoiseRef = useRef<AudioBufferSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  const stopWhiteNoise = () => {
    if (whiteNoiseRef.current) {
      try { whiteNoiseRef.current.stop() } catch {}
      whiteNoiseRef.current = null
    }
  }

  const startWhiteNoise = (vol: number) => {
    stopWhiteNoise()
    const ctx = audioCtxRef.current || new AudioContext()
    audioCtxRef.current = ctx
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gain = ctx.createGain()
    gain.gain.value = vol
    gainRef.current = gain
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start()
    whiteNoiseRef.current = source
  }

  const stopAll = () => {
    stopWhiteNoise()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const play = (trackId: string, vol: number) => {
    stopAll()
    if (trackId === 'silence') return
    if (trackId === 'whitenoise') {
      startWhiteNoise(vol)
      return
    }
    const track = TRACKS.find(t => t.id === trackId)
    if (!track?.url) return
    if (!audioRef.current) audioRef.current = new Audio()
    audioRef.current.src = track.url
    audioRef.current.loop = true
    audioRef.current.volume = vol
    audioRef.current.play().catch(() => {})
  }

  useEffect(() => {
    return () => {
      stopAll()
      if (audioCtxRef.current) { audioCtxRef.current.close() }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTrackSelect = (trackId: string) => {
    setActiveTrack(trackId)
    if (isPlaying) play(trackId, volume)
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      stopAll()
      setIsPlaying(false)
    } else {
      play(activeTrack, volume)
      setIsPlaying(true)
    }
  }

  const handleVolume = (val: number) => {
    setVolume(val)
    if (audioRef.current) audioRef.current.volume = val
    if (gainRef.current) gainRef.current.gain.value = val
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
                ? 'bg-indigo-600 text-foreground'
                : 'bg-gray-800 text-muted-foreground hover:border-indigo-500/30 hover:text-foreground'
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
          className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors"
        >
          {isPlaying ? <Pause className="w-4 h-4 text-foreground" /> : <Play className="w-4 h-4 text-foreground ml-0.5" />}
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
            className="flex-1 accent-indigo-500 h-1.5 rounded-full cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}

