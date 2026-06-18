import { createClient } from "@/lib/supabase/server";

export interface DailyAggregate {
  date: string;
  journalCount: number;
  manifestCount: number;
}

export interface DayDetail {
  date: string;
  journalEntries: Array<{
    id: string;
    raw_input: string;
    ai_response: string | null;
    ai_structured: unknown;
    created_at: string;
  }>;
  manifestEntries: Array<{
    id: string;
    intention: string;
    category: string;
    ai_echo: string | null;
    keywords: string[];
    created_at: string;
  }>;
}

export interface SearchHit {
  type: "journal" | "manifest";
  id: string;
  date: string;
  snippet: string;
}

export function aggregateMonthEntries(
  journalEntries: Array<{ entry_date: string }>,
  manifestEntries: Array<{ entry_date: string }>
): Record<string, DailyAggregate> {
  const out: Record<string, DailyAggregate> = {};
  const ensure = (date: string): DailyAggregate => {
    if (!out[date]) out[date] = { date, journalCount: 0, manifestCount: 0 };
    return out[date];
  };
  for (const e of journalEntries) ensure(e.entry_date).journalCount += 1;
  for (const e of manifestEntries) ensure(e.entry_date).manifestCount += 1;
  return out;
}

export async function fetchMonthAggregate(
  userId: string,
  year: number,
  month: number
): Promise<Record<string, DailyAggregate>> {
  const supabase = await createClient();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [{ data: journals }, { data: manifests }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("entry_date")
      .eq("user_id", userId)
      .gte("entry_date", start)
      .lte("entry_date", end),
    supabase
      .from("manifest_entries")
      .select("entry_date")
      .eq("user_id", userId)
      .gte("entry_date", start)
      .lte("entry_date", end),
  ]);

  return aggregateMonthEntries(journals ?? [], manifests ?? []);
}

export async function fetchDayDetail(
  userId: string,
  date: string
): Promise<DayDetail> {
  const supabase = await createClient();
  const [{ data: journals }, { data: manifests }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, raw_input, ai_response, ai_structured, created_at")
      .eq("user_id", userId)
      .eq("entry_date", date)
      .order("created_at", { ascending: true }),
    supabase
      .from("manifest_entries")
      .select("id, intention, category, ai_echo, keywords, created_at")
      .eq("user_id", userId)
      .eq("entry_date", date)
      .order("created_at", { ascending: true }),
  ]);
  return {
    date,
    journalEntries: journals ?? [],
    manifestEntries: manifests ?? [],
  };
}

export async function searchEntries(
  userId: string,
  query: string,
  limit: number = 30
): Promise<SearchHit[]> {
  const supabase = await createClient();
  const trimmed = query.trim();
  if (!trimmed) return [];
  const pattern = `%${trimmed.replace(/[%_]/g, (c) => `\\${c}`)}%`;

  const [{ data: journalHits }, { data: manifestHits }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, entry_date, raw_input, ai_response")
      .eq("user_id", userId)
      .or(`raw_input.ilike.${pattern},ai_response.ilike.${pattern}`)
      .order("entry_date", { ascending: false })
      .limit(limit),
    supabase
      .from("manifest_entries")
      .select("id, entry_date, intention, ai_echo")
      .eq("user_id", userId)
      .or(`intention.ilike.${pattern},ai_echo.ilike.${pattern}`)
      .order("entry_date", { ascending: false })
      .limit(limit),
  ]);

  const buildSnippet = (text: string | null): string => {
    if (!text) return "";
    const idx = text.toLowerCase().indexOf(trimmed.toLowerCase());
    if (idx < 0) return text.slice(0, 80);
    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + trimmed.length + 30);
    return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
  };

  const journalResults: SearchHit[] = (journalHits ?? []).map((row) => ({
    type: "journal",
    id: row.id,
    date: row.entry_date,
    snippet: buildSnippet(row.raw_input ?? row.ai_response),
  }));
  const manifestResults: SearchHit[] = (manifestHits ?? []).map((row) => ({
    type: "manifest",
    id: row.id,
    date: row.entry_date,
    snippet: buildSnippet(row.intention ?? row.ai_echo),
  }));

  return [...journalResults, ...manifestResults]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}