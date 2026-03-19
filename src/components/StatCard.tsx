'use client';

import { Share2, Download } from 'lucide-react';
import { useRef } from 'react';

interface StatCardProps {
  type: 'workout' | 'morning';
  stats: {
    label: string;
    value: string;
    subtext?: string;
  }[];
  title: string;
  subtitle: string;
}

export default function StatCard({ type, stats, title, subtitle }: StatCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Dad Strength - ${title}`,
          text: `Just finished my ${title}! #DadStrength #ForgeOS`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={cardRef}
        className="aspect-square w-full max-w-sm mx-auto bg-foreground p-8 flex flex-col justify-between relative overflow-hidden"
      >
        {/* Corner accents */}
        <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-background/20" />
        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-background/20" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-0.5 bg-brand" />
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-brand">Forge OS / Archive</span>
          </div>
          <h2 className="text-4xl font-light text-background leading-none mb-1 tracking-tight">
            {title}
          </h2>
          <p className="text-sm font-light uppercase tracking-[0.12em] text-background/50">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 relative z-10">
          {stats.map((stat, i) => (
            <div key={i} className="border-l border-background/20 pl-4">
              <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-background/50 mb-1">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-light text-background tabular-nums">{stat.value}</p>
                {stat.subtext && <p className="text-xs font-medium text-brand uppercase">{stat.subtext}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-end relative z-10">
          <div className="text-[8px] font-medium uppercase tracking-[0.15em] text-background/30">
            {new Date().toLocaleDateString()}
          </div>
          <div className="w-10 h-10 bg-background flex items-center justify-center rounded">
            <span className="text-foreground font-semibold text-sm">DS</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex-1 bg-foreground hover:opacity-90 text-background font-medium uppercase tracking-[0.1em] py-3.5 text-xs flex items-center justify-center gap-2 transition-opacity active:scale-[0.98] rounded-lg"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
        <button className="w-12 border border-border flex items-center justify-center hover:border-foreground/30 transition-colors rounded-lg">
          <Download className="w-4 h-4 text-foreground" />
        </button>
      </div>
    </div>
  );
}
