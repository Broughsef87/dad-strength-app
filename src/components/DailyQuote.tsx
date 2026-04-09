'use client';

import { useEffect, useState } from 'react';

const quotes = [
  { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "You have power over your mind - not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "Peace comes from within. Do not seek it without.", author: "Buddha" },
  { text: "Do not let the behavior of others destroy your inner peace.", author: "Dalai Lama" },
  { text: "Nature does not hurry, yet everything is accomplished.", author: "Lao Tzu" },
  { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { text: "To a mind that is still, the whole universe surrenders.", author: "Lao Tzu" },
  { text: "What we achieve inwardly will change outer reality.", author: "Plutarch" },
  { text: "He who conquers himself is the mightiest warrior.", author: "Confucius" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "Muddy water is best cleared by leaving it alone.", author: "Alan Watts" },
  { text: "The more you know, the less you need.", author: "Yvon Chouinard" }
];

export default function DailyQuote() {
  const [quote, setQuote] = useState(quotes[0]);

  useEffect(() => {
    const dateString = new Date().toLocaleDateString('en-CA');
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
      hash = dateString.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % quotes.length;
    setQuote(quotes[index]);
  }, []);

  return (
    <div className="glass-card rounded-xl p-5 border border-border flex flex-col items-center justify-center text-center space-y-3">
      <div className="text-4xl text-muted-foreground/20 font-serif leading-none -mb-1 self-start">&quot;</div>
      <p className="text-sm text-muted-foreground font-light italic leading-relaxed px-2">
        {quote.text}
      </p>
      <p className="text-xs text-muted-foreground uppercase tracking-[0.15em] font-medium">
        — {quote.author}
      </p>
    </div>
  );
}
