import { createClient } from "@/lib/supabase/server";
import { computeEntryDate, APP_TIMEZONE } from "@/lib/date";
import type {
  ManifestEntry,
  ManifestCreateInput,
  ManifestCategory,
} from "@/types/manifest";

function getEntryDate(): string {
  return computeEntryDate(new Date(), APP_TIMEZONE);
}

export async function createManifestEntry(
  userId: string,
  input: ManifestCreateInput
): Promise<ManifestEntry> {
  const supabase = await createClient();
  const entryDate = getEntryDate();

  const { data, error } = await supabase
    .from("manifest_entries")
    .insert({
      user_id: userId,
      entry_date: entryDate,
      intention: input.intention,
      category: input.category,
      ai_echo: null,
      keywords: [],
    })
    .select()
    .single();

  if (error) throw error;
  return mapToManifestEntry(data);
}

export async function updateManifestEcho(
  entryId: string,
  echo: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("manifest_entries")
    .update({ ai_echo: echo })
    .eq("id", entryId);

  if (error) throw error;
}

export async function updateManifestAnalysis(
  entryId: string,
  keywords: string[],
  insight: string
): Promise<void> {
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("manifest_entries")
    .select("ai_echo")
    .eq("id", entryId)
    .single();

  const existingEcho = current?.ai_echo ?? "";
  const { error } = await supabase
    .from("manifest_entries")
    .update({
      keywords,
      ai_echo: existingEcho
        ? `${existingEcho}\n\n💡 ${insight}`
        : `💡 ${insight}`,
    })
    .eq("id", entryId);

  if (error) throw error;
}

export async function getManifestEntriesByDate(
  userId: string,
  date: string
): Promise<ManifestEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("manifest_entries")
    .select()
    .eq("user_id", userId)
    .eq("entry_date", date)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapToManifestEntry);
}

export async function getRecentManifestEntries(
  userId: string,
  limit: number = 10
): Promise<ManifestEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("manifest_entries")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapToManifestEntry);
}

function mapToManifestEntry(data: Record<string, unknown>): ManifestEntry {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    createdAt: data.created_at as string,
    entryDate: data.entry_date as string,
    intention: data.intention as string,
    category: data.category as ManifestCategory,
    aiEcho: data.ai_echo as string | null,
    keywords: (data.keywords as string[]) ?? [],
  };
}