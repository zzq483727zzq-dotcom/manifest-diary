import Link from "next/link";
import type { SearchHit } from "@/lib/supabase/history";

interface SearchResultsProps { query: string; hits: SearchHit[]; }

function highlightMatch(snippet: string, query: string) {
  if (!query) return snippet;
  const idx = snippet.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return snippet;
  return (
    <>
      {snippet.slice(0, idx)}
      <mark style={{ background: "rgba(251,191,36,0.3)", color: "#fde68a", borderRadius: 2, padding: "0 2px" }}>
        {snippet.slice(idx, idx + query.length)}
      </mark>
      {snippet.slice(idx + query.length)}
    </>
  );
}

export function SearchResults({ query, hits }: SearchResultsProps) {
  if (hits.length === 0) {
    return (
      <p className="text-center py-12" style={{ color: "var(--text-secondary)" }}>
        没有找到包含「{query}」的记录。
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {hits.map((hit) => (
        <li key={`${hit.type}-${hit.id}`}>
          <Link
            href={`/history/${hit.date}`}
            className="block p-4 rounded-xl transition-colors"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
              <span>{hit.type === "journal" ? "🌙 复盘" : "✨ 显化"}</span>
              <span>{hit.date}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {highlightMatch(hit.snippet, query)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}