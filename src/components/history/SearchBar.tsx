"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SearchBarProps { initialQuery?: string; }

export function SearchBar({ initialQuery = "" }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/history/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索复盘和显化里的字句…"
        style={{
          width: "100%",
          padding: "10px 48px 10px 16px",
          borderRadius: 9999,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          fontSize: 14,
          outline: "none",
        }}
        onFocus={(e) => { e.target.style.borderColor = "var(--accent-rose)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
      />
      <button
        type="submit"
        disabled={!query.trim()}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          padding: "4px 12px",
          borderRadius: 9999,
          fontSize: 12,
          border: "none",
          cursor: query.trim() ? "pointer" : "not-allowed",
          background: "var(--accent-rose-gold)",
          color: "#0f172a",
          opacity: query.trim() ? 1 : 0.3,
        }}
      >
        搜
      </button>
    </form>
  );
}