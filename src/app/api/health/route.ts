import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check Supabase connection
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    checks.supabase = error ? `ERROR: ${error.message}` : "OK";
  } catch {
    checks.supabase = "ERROR: connection failed";
  }

  const allOk = Object.values(checks).every((v) => v === "OK");

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}
