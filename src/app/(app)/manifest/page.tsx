"use client";

import { useState, useCallback } from "react";
import { StarfieldBackground } from "@/components/manifest/StarfieldBackground";
import { CategorySelector } from "@/components/manifest/CategorySelector";
import { IntentionInput } from "@/components/manifest/IntentionInput";
import { EchoBubble } from "@/components/manifest/EchoBubble";
import { KeywordTags } from "@/components/manifest/KeywordTags";
import { ManifestCard } from "@/components/manifest/ManifestCard";
import { computeEntryDate, APP_TIMEZONE } from "@/lib/date";
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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!intention.trim() || !category || isProcessing) return;
    setIsProcessing(true);
    setEcho(null);
    setKeywords([]);
    setInsight(null);
    setError(null);

    let echoOk = false;

    try {
      // 1. Create entry (critical — must succeed)
      const createRes = await fetch("/api/manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intention, category }),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.error ?? "创建失败");
      }
      const createData = await createRes.json();
      const entryId: string = createData.entry.id;

      // 2. Echo (best-effort, independent of analyze)
      try {
        const echoRes = await fetch("/api/ai/echo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId, intention }),
        });
        if (echoRes.ok) {
          const echoData = await echoRes.json();
          setEcho(echoData.echo);
          echoOk = true;
        } else {
          const body = await echoRes.json().catch(() => ({}));
          setError(`AI 回响生成失败：${body.error ?? echoRes.status}`);
        }
      } catch (e) {
        setError(`AI 回响生成失败：${String(e)}`);
      }

      // 3. Analyze (best-effort, independent of echo)
      try {
        const analyzeRes = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId, intention }),
        });
        if (analyzeRes.ok) {
          const analyzeData = await analyzeRes.json();
          setKeywords(analyzeData.keywords ?? []);
          setInsight(analyzeData.insight ?? null);
        } else if (!echoOk) {
          // only surface analyze error if echo already failed
          const body = await analyzeRes.json().catch(() => ({}));
          setError((prev) => prev ?? `关键词分析失败：${body.error ?? analyzeRes.status}`);
        }
      } catch {
        if (!echoOk) setError((prev) => prev ?? "关键词分析失败");
      }

      // 4. Refresh history (non-critical)
      try {
        const today = computeEntryDate(new Date(), APP_TIMEZONE);
        const listRes = await fetch(`/api/manifest?date=${today}`);
        if (listRes.ok) {
          const listData = await listRes.json();
          setTodayEntries(listData.entries ?? []);
        }
      } catch {
        /* non-critical */
      }

      // Clear form only on full success (echo produced)
      if (echoOk) {
        setIntention("");
        setCategory(null);
      }
    } catch (err) {
      console.error("Manifest submission failed:", err);
      setError(err instanceof Error ? err.message : "提交失败，请稍后再试");
    } finally {
      setIsProcessing(false);
    }
  }, [intention, category, isProcessing]);

  return (
    <div className="relative overflow-hidden" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
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

        {error && (
          <div className="mx-auto max-w-md p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
          </div>
        )}

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
