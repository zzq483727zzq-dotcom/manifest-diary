import { redirect } from 'next/navigation';
import { hasLocalPassword, hasLocalSession } from '@/lib/local-auth';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fast JWT decode — no Supabase round-trip (~1ms vs ~300ms).
  // Middleware keeps the cookie fresh; RLS still enforces authz on writes.
  if (!hasLocalPassword()) redirect('/setup');
  if (!await hasLocalSession()) redirect('/unlock');

  return <DashboardShell userEmail="本地用户">{children}</DashboardShell>;
}
