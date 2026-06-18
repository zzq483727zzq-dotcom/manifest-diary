import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchMonthAggregate } from "@/lib/supabase/history";
import { CalendarGrid } from "@/components/history/CalendarGrid";
import { SearchBar } from "@/components/history/SearchBar";

interface PageProps { searchParams: Promise<{ year?: string; month?: string }>; }

export default async function HistoryPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const aggregates = await fetchMonthAggregate(user.id, year, month);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-light" style={{ color: "var(--text-primary)" }}>
          ✦ 日历回看
        </h1>
        <SearchBar />
      </header>
      <CalendarGrid year={year} month={month} aggregates={aggregates} />
    </div>
  );
}