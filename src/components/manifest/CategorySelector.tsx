"use client";
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
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-out border ${
              isSelected
                ? "border-rose-gold bg-rose-gold/20 text-white shadow-[0_0_12px_rgba(255,182,193,0.3)]"
                : "border-white/20 bg-white/5 text-white/60 hover:border-white/40 hover:text-white/80"
            }`}
          >
            <span className="mr-1.5">{MANIFEST_CATEGORY_ICONS[cat]}</span>
            {MANIFEST_CATEGORY_LABELS[cat]}
          </button>
        );
      })}
    </div>
  );
}