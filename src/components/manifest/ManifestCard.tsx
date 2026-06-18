"use client";
import type { ManifestEntry } from "@/types/manifest";
import { MANIFEST_CATEGORY_LABELS, MANIFEST_CATEGORY_ICONS } from "@/types/manifest";
import { KeywordTags } from "./KeywordTags";

interface ManifestCardProps { entry: ManifestEntry; }

export function ManifestCard({ entry }: ManifestCardProps) {
  const time = new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-rose-gold/80">{MANIFEST_CATEGORY_ICONS[entry.category]} {MANIFEST_CATEGORY_LABELS[entry.category]}</span>
        <span className="text-white/30">{time}</span>
      </div>
      <p className="text-white/80 text-sm leading-relaxed">{entry.intention}</p>
      {entry.aiEcho && (
        <div className="pl-3 border-l-2 border-rose-gold/30">
          <p className="text-white/60 text-sm italic">{entry.aiEcho}</p>
        </div>
      )}
      {entry.keywords.length > 0 && <KeywordTags keywords={entry.keywords} />}
    </div>
  );
}