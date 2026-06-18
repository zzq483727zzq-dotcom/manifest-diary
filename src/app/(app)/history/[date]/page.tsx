import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchDayDetail } from "@/lib/supabase/history";
import { DayDetailView } from "@/components/history/DayDetailView";

interface PageProps { params: Promise<{ date: string }>; }

export default async function DayDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const detail = await fetchDayDetail(user.id, date);
  const [y, m, d] = date.split("-");
  const formatted = `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href={`/history?year=${y}&month=${Number(m)}`} className="text-sm" style={{ color: "var(--text-secondary)" }}>
          ← 回到日历
        </Link>
        <h1 className="text-xl font-light" style={{ color: "var(--text-primary)" }}>{formatted}</h1>
      </header>
      <DayDetailView detail={detail} />
    </div>
  );
}