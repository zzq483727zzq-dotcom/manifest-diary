import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="text-center">
        <h1 className="text-3xl font-light" style={{ color: "var(--text-primary)" }}>
          晚上好 ✨
        </h1>
        <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
          准备好今晚的复盘了吗？
        </p>
      </div>
    </main>
  );
}
