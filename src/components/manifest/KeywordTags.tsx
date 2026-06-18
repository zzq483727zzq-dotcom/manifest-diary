"use client";

interface KeywordTagsProps { keywords: string[]; }

export function KeywordTags({ keywords }: KeywordTagsProps) {
  if (!keywords.length) return null;
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {keywords.map((keyword, i) => (
        <span key={`${keyword}-${i}`} className="px-3 py-1 rounded-full text-xs font-medium bg-rose-gold/15 border border-rose-gold/25 text-rose-gold animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
          {keyword}
        </span>
      ))}
    </div>
  );
}