"use client";

import { useState, useCallback } from "react";
import { StarfieldBackground } from "@/components/manifest/StarfieldBackground";
import { CategorySelector } from "@/components/manifest/CategorySelector";
import { IntentionInput } from "@/components/manifest/IntentionInput";
import { EchoBubble } from "@/components/manifest/EchoBubble";
import { KeywordTags } from "@/components/manifest/KeywordTags";
import { ManifestCard } from "@/components/manifest/ManifestCard";
import type { ManifestCategory, ManifestEntry } from "@/types/manifest";

export default function ManifestPage() {
  const [intention, setIntention] = useState("");
  const [category, setCategory] = useState<ManifestCategory | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [echo, setEcho] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [insight, setInsight] = useState<string | null>(null);
  const [todayEntries, setTodayEntries] = useState<ManifestEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!intention.trim() || !category || isProcessing) return;
    setIsProcessing(true);
    setEcho(null);
    setKeywords([]);
    setInsight(null);

    try {
      const createRes = await fetch("/api/manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intention, category }),
      });
      const createData = await createRes.json();
      const entryId = createData.entry.id;

      const echoRes = await fetch("/api/ai/echo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, intention }),
      });
      const echoData = await echoRes.json();
      setEcho(echoData.echo);

      const analyzeRes = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, intention }),
      });
      const analyzeData = await analyzeRes.json();
      setKeywords(analyzeData.keywords ?? []);
      setInsight(analyzeData.insight ?? null);

      const today = new Date().toISOString().split("T")[0];
      const listRes = await fetch(`/api/manifest?date=${today}`);
      const listData = await listRes.json();
      setTodayEntries(listData.entries ?? []);

      setIntention("");
      setCategory(null);
    } catch (err) {
      console.error("Manifest submission failed:", err);
      setEcho("星尘暂时迷路了……请再试一次 ✨");
    } finally {
      setIsProcessing(false);
    }
  }, [intention, category, isProcessing]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0a2e] via-[#1a1145] to-[#0d0820] text-white relative overflow-hidden">
      <StarfieldBackground />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-2xl font-light tracking-wider text-white/90">✨ 显化仪式</h1>
          <p className="text-sm text-white/30">写下你的意图，宇宙会回应</p>
        </header>

        <section>
          <CategorySelector selected={category} onSelect={setCategory} />
        </section>

        <section>
          <IntentionInput
            value={intention}
            onChange={setIntention}
            onSubmit={handleSubmit}
            isProcessing={isProcessing}
          />
        </section>

        {(echo || isProcessing) && (
          <section className="space-y-4">
            <EchoBubble echo={echo ?? ""} isLoading={isProcessing && !echo} />
            {keywords.length > 0 && <KeywordTags keywords={keywords} />}
            {insight && (
              <p className="text-center text-white/40 text-sm italic">💡 {insight}</p>
            )}
          </section>
        )}

        {todayEntries.length > 0 && (
          <section className="space-y-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-white/30 hover:text-white/50 transition-colors"
            >
              {showHistory ? "收起" : "查看"}今日显化（{todayEntries.length}）
            </button>
            {showHistory && (
              <div className="space-y-3">
                {todayEntries.map((entry) => (
                  <ManifestCard key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}