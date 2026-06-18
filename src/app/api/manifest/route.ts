import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ManifestCategory } from "@/types/manifest";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const limit = parseInt(searchParams.get("limit") ?? "10", 10);

  let query = supabase.from("manifest_entries").select().eq("user_id", user.id);
  if (date) query = query.eq("entry_date", date);
  query = query.order("created_at", { ascending: false }).limit(date ? 100 : limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { intention, category } = await request.json();
  if (!intention || !category) {
    return NextResponse.json({ error: "intention and category are required" }, { status: 400 });
  }

  const validCategories: ManifestCategory[] = ["self", "relationship", "career", "health", "abundance", "other"];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: `category must be one of: ${validCategories.join(", ")}` }, { status: 400 });
  }

  const now = new Date();
  let entryDate: string;
  if (now.getHours() < 4) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    entryDate = yesterday.toISOString().split("T")[0];
  } else {
    entryDate = now.toISOString().split("T")[0];
  }

  const { data, error } = await supabase
    .from("manifest_entries")
    .insert({ user_id: user.id, entry_date: entryDate, intention, category, ai_echo: null, keywords: [] })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data }, { status: 201 });
}