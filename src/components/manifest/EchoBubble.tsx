"use client";

interface EchoBubbleProps { echo: string; isLoading?: boolean; }

export function EchoBubble({ echo, isLoading }: EchoBubbleProps) {
  if (isLoading) {
    return (
      <div className="mx-auto max-w-md px-6 py-4 rounded-2xl bg-gradient-to-br from-rose-gold/10 to-pink-400/5 border border-rose-gold/20 animate-pulse">
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <span className="animate-spin">✨</span> 宇宙正在倾听……
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md px-6 py-4 rounded-2xl bg-gradient-to-br from-rose-gold/10 to-pink-400/5 border border-rose-gold/30 shadow-[0_0_24px_rgba(255,182,193,0.15)] animate-fade-in">
      <p className="text-white/90 text-base leading-relaxed italic">{echo}</p>
    </div>
  );
}