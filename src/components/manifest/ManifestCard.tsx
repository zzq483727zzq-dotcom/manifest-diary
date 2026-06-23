"use client";
import { motion } from "framer-motion";
import type { ManifestEntry } from "@/types/manifest";
import { MANIFEST_CATEGORY_LABELS, MANIFEST_CATEGORY_ICONS } from "@/types/manifest";
import { KeywordTags } from "./KeywordTags";

interface ManifestCardProps {
  entry: ManifestEntry;
  index?: number;
}

export function ManifestCard({ entry, index = 0 }: ManifestCardProps) {
  const time = new Date(entry.createdAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: "easeOut" }}
      className="rounded-2xl p-5 space-y-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: "var(--accent-rose)" }}>
          {MANIFEST_CATEGORY_ICONS[entry.category]} {MANIFEST_CATEGORY_LABELS[entry.category]}
        </span>
        <span className="text-white/30">{time}</span>
      </div>
      <p className="text-white/80 text-sm leading-relaxed">{entry.intention}</p>
      {entry.aiEcho && (
        <div
          className="pl-3"
          style={{ borderLeft: "2px solid rgba(244,114,182,0.45)" }}
        >
          <p
            className="text-white/65 text-sm italic"
            style={{ fontFamily: "'Georgia', 'Noto Serif SC', serif" }}
          >
            {entry.aiEcho}
          </p>
        </div>
      )}
      {entry.keywords.length > 0 && <KeywordTags keywords={entry.keywords} />}
    </motion.div>
  );
}
