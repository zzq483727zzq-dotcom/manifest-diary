import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/auth';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fast JWT decode — no Supabase round-trip (~1ms vs ~300ms).
  // Middleware keeps the cookie fresh; RLS still enforces authz on writes.
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return <DashboardShell userEmail={user.email}>{children}</DashboardShell>;
}
