"use client";
import { motion } from "framer-motion";
import type { ManifestCategory } from "@/types/manifest";
import { MANIFEST_CATEGORY_LABELS, MANIFEST_CATEGORY_ICONS } from "@/types/manifest";

const CATEGORIES = Object.keys(MANIFEST_CATEGORY_LABELS) as ManifestCategory[];

interface CategorySelectorProps {
  selected: ManifestCategory | null;
  onSelect: (category: ManifestCategory) => void;
}

export function CategorySelector({ selected, onSelect }: CategorySelectorProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {CATEGORIES.map((cat) => {
        const isSelected = selected === cat;
        return (
          <motion.button
            key={cat}
            onClick={() => onSelect(cat)}
            whileTap={{ scale: 0.94 }}
            animate={{ scale: isSelected ? 1.06 : 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="relative px-4 py-2 rounded-full text-sm font-medium overflow-hidden border"
            style={
              isSelected
                ? {
                    borderColor: "transparent",
                    background:
                      "linear-gradient(135deg, rgba(244,114,182,0.85), rgba(192,132,252,0.75))",
                    color: "#fff",
                    boxShadow: "var(--shadow-glow)",
                  }
                : {
                    borderColor: "rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.6)",
                  }
            }
          >
            {/* Shimmer sweep on selected */}
            {isSelected && (
              <motion.span
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                initial={{ x: "-120%" }}
                animate={{ x: "120%" }}
                transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.4 }}
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                  width: "40%",
                }}
              />
            )}
            <span className="relative mr-1.5">{MANIFEST_CATEGORY_ICONS[cat]}</span>
            <span className="relative">{MANIFEST_CATEGORY_LABELS[cat]}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
