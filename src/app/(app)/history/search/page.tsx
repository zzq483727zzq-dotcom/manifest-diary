import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { searchEntries } from "@/lib/supabase/history";
import { SearchBar } from "@/components/history/SearchBar";
import { SearchResults } from "@/components/history/SearchResults";

interface PageProps { searchParams: Promise<{ q?: string }>; }

export default async function SearchPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const hits = query ? await searchEntries(user.id, query) : [];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-xl font-light" style={{ color: "var(--text-primary)" }}>
          搜索：<span style={{ color: "#f472b6" }}>{query || "—"}</span>
        </h1>
        <SearchBar initialQuery={query} />
      </header>
      {query ? <SearchResults query={query} hits={hits} /> : <p className="text-center py-12" style={{ color: "var(--text-secondary)" }}>输入关键词开始搜索。</p>}
    </div>
  );
}