'use client'

import { useEffect, useState } from 'react'
import { BookOpen, ExternalLink, CheckCircle2 } from 'lucide-react'

const BOOKS = [
  {
    id: 'cant-hurt-me',
    title: "Can't Hurt Me",
    author: 'David Goggins',
    desc: 'Master your mind and defy the odds.',
    url: 'https://www.goodreads.com/book/show/41721428',
  },
  {
    id: 'meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    desc: 'Timeless wisdom for the modern dad.',
    url: 'https://www.goodreads.com/book/show/30659',
  },
  {
    id: 'comfort-crisis',
    title: 'The Comfort Crisis',
    author: 'Michael Easter',
    desc: 'Embrace discomfort to reclaim your wild, healthy self.',
    url: 'https://www.goodreads.com/book/show/55825273',
  },
  {
    id: 'strong-fathers',
    title: 'Strong Fathers, Strong Daughters',
    author: 'Meg Meeker',
    desc: '10 secrets every father should know.',
    url: 'https://www.goodreads.com/book/show/276033',
  },
  {
    id: 'way-of-men',
    title: 'The Way of Men',
    author: 'Jack Donovan',
    desc: 'What it means to be a man.',
    url: 'https://www.goodreads.com/book/show/13540572',
  },
]

const STORAGE_KEY = 'dad-strength-reading-state'

export default function RecommendedReading() {
  const [currentlyReading, setCurrentlyReading] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setCurrentlyReading(JSON.parse(saved))
    } catch {}
  }, [])

  const toggleReading = (id: string) => {
    const next = currentlyReading === id ? null : id
    setCurrentlyReading(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-black flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5" /> Recommended Reading
      </p>

      {BOOKS.map(book => {
        const active = currentlyReading === book.id
        return (
          <div
            key={book.id}
            className={`rounded-2xl border p-4 flex items-start justify-between gap-3 transition-all ${
              active ? 'border-indigo-500/50 bg-indigo-950/30' : 'border-border bg-card'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-semibold text-sm leading-tight">{book.title}</p>
              <p className="text-indigo-400 text-xs mt-0.5">{book.author}</p>
              <p className="text-muted-foreground text-xs mt-1">{book.desc}</p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <a
                href={book.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-indigo-400 transition-colors"
                aria-label="Learn more"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={() => toggleReading(book.id)}
                title={active ? 'Currently reading' : 'Mark as reading'}
                className={`transition-colors ${active ? 'text-emerald-400' : 'text-gray-700 hover:text-muted-foreground'}`}
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      })}

      {currentlyReading && (
        <p className="text-xs text-muted-foreground text-center">
          âœ… Currently reading: <span className="text-indigo-400">{BOOKS.find(b => b.id === currentlyReading)?.title}</span>
        </p>
      )}
    </div>
  )
}

