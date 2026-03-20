'use client';

import { useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';

export default function AutomationHook() {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // For now, we'll just log it. In the future, this connects to Supabase/Skool.
    console.log('Automation wish:', input);

    // Simulate API call
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setInput('');
    }, 3000);
  };

  return (
    <div className="bg-card/50 border border-brand/20 rounded-3xl p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Bot className="w-12 h-12 text-brand" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-brand/10 rounded-lg">
            <Sparkles className="w-4 h-4 text-brand" />
          </div>
          <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">The Mission</h2>
        </div>

        <h3 className="text-xl font-black text-foreground mb-2 leading-tight">
          Automate the Boring,<br />
          Focus on the Meaningful.
        </h3>

        <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
          What is one thing you wish you could automate today so you could spend more time with your family?
        </p>

        {submitted ? (
          <div className="bg-brand/10 border border-brand/30 rounded-2xl p-4 text-center">
            <p className="text-brand font-bold text-xs uppercase tracking-widest">Wish Received. Processing...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Logging protein, scheduling emails..."
              className="flex-1 bg-black/50 border border-border rounded-xl px-4 py-3 text-xs text-foreground placeholder:text-gray-600 focus:outline-none focus:border-brand/50 transition-all"
            />
            <button
              type="submit"
              className="bg-brand hover:bg-brand/90 text-foreground p-3 rounded-xl transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

