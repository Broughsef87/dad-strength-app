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
  { text: "If you are depressed you are living in the past. If you are anxious you are living in the future. If you are at peace you are living in the present.", author: "Lao Tzu" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "Muddy water is best cleared by leaving it alone.", author: "Alan Watts" },
  { text: "The more you know, the less you need.", author: "Yvon Chouinard" }
];

export default function DailyQuote() {
  const [quote, setQuote] = useState(quotes[0]);

  useEffect(() => {
    // Generate a consistent index based on the current date (YYYY-MM-DD local time)
    const dateString = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
      hash = dateString.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % quotes.length;
    setQuote(quotes[index]);
  }, []);

  return (
    <div className="rounded-2xl bg-gray-900/50 p-6 border border-gray-800/80 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
      <div className="absolute -top-4 -left-2 text-gray-800/30 text-8xl font-serif pointer-events-none">"</div>
      <p className="text-gray-300 text-sm italic z-10 font-serif leading-relaxed px-2">
        {quote.text}
      </p>
      <p className="text-indigo-400/80 text-[10px] uppercase font-black tracking-widest z-10">
        — {quote.author}
      </p>
    </div>
  );
}