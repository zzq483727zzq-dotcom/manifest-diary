import { redirect } from 'next/navigation';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { NavBar } from '@/components/ui/NavBar';
import { LampGlow } from '@/components/ui/LampGlow';
import { getSessionUser } from '@/lib/supabase/auth';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fast JWT decode — no Supabase round-trip (~1ms vs ~300ms).
  // Middleware keeps the cookie fresh; RLS still enforces authz on writes.
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <ThemeProvider defaultTheme="night">
      <div className="min-h-screen" style={{ color: 'var(--text-primary)' }}>
        <LampGlow />
        <NavBar userEmail={user.email} />
        <main className="max-w-3xl mx-auto px-4 py-8 relative z-10">{children}</main>
      </div>
    </ThemeProvider>
  );
}