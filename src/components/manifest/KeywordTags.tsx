"use client";
import { motion } from "framer-motion";

interface KeywordTagsProps {
  keywords: string[];
}

export function KeywordTags({ keywords }: KeywordTagsProps) {
  if (!keywords.length) return null;
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {keywords.map((keyword, i) => (
        <motion.span
          key={`${keyword}-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
          whileHover={{ y: -2 }}
          className="px-3 py-1 rounded-full text-xs font-medium text-white/90"
          style={{
            background: "rgba(244,114,182,0.14)",
            border: "1px solid rgba(244,114,182,0.35)",
            boxShadow: "0 0 0 rgba(244,114,182,0)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 14px rgba(244,114,182,0.35)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 0 rgba(244,114,182,0)";
          }}
        >
          {keyword}
        </motion.span>
      ))}
    </div>
  );
}
