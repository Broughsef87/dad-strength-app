'use client';

import { Download, Share2, Sparkles } from 'lucide-react';
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
    // In a real app, we'd use html2canvas or similar to generate an image
    // For now, we'll trigger the native share API if available
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
    <div className="space-y-4">
      <div 
        ref={cardRef}
        className="aspect-square w-full max-w-sm mx-auto bg-black border-4 border-white p-8 flex flex-col justify-between relative overflow-hidden group"
      >
        {/* Gritty Noise/Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/asfalt-dark.png')]" />
        
        {/* Border Accents */}
        <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-white -mr-1 -mt-1" />
        <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-white -ml-1 -mb-1" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-1 bg-indigo-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">Forge OS / Archive</span>
          </div>
          <h2 className="text-5xl font-black italic uppercase tracking-tighter text-foreground leading-none mb-1">
            {title}
          </h2>
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 relative z-10">
          {stats.map((stat, i) => (
            <div key={i} className="border-l-2 border-white/20 pl-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-foreground tracking-tighter italic">{stat.value}</p>
                {stat.subtext && <p className="text-xs font-bold text-indigo-500 uppercase">{stat.subtext}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-end relative z-10">
          <div className="text-[8px] font-black uppercase tracking-widest text-foreground/30">
            Authenticated Protocol // {new Date().toLocaleDateString()}
          </div>
          <div className="w-12 h-12 bg-white flex items-center justify-center">
             <span className="text-black font-black text-2xl tracking-tighter italic">DS</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={handleShare}
          className="flex-1 bg-white hover:bg-gray-200 text-black font-black uppercase tracking-widest py-4 text-xs flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <Share2 className="w-4 h-4" />
          Blast to Socials
        </button>
        <button className="w-14 bg-card border border-border flex items-center justify-center hover:border-white transition-colors">
          <Download className="w-4 h-4 text-foreground" />
        </button>
      </div>
    </div>
  );
}

