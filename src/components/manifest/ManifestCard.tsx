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
      className="rounded-2xl p-5 space-y-3 glow-border"
      style={{
        background: "var(--bg-card-glow)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: "var(--gold-bright)" }}>
          {MANIFEST_CATEGORY_ICONS[entry.category]} {MANIFEST_CATEGORY_LABELS[entry.category]}
        </span>
        <span style={{ color: "var(--text-secondary)", opacity: 0.6 }}>{time}</span>
      </div>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--text-primary)" }}
      >
        {entry.intention}
      </p>
      {entry.aiEcho && (
        <div
          className="pl-3"
          style={{ borderLeft: "2px solid var(--border-strong)" }}
        >
          <p
            className="font-ai text-sm italic"
            style={{
              color: "var(--text-secondary)",
              opacity: 0.9,
              letterSpacing: "0.04em",
            }}
          >
            {entry.aiEcho}
          </p>
        </div>
      )}
      {entry.keywords.length > 0 && <KeywordTags keywords={entry.keywords} />}
    </motion.div>
  );
}
