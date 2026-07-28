import { redirect } from 'next/navigation';
import { hasLocalPassword, hasLocalSession } from '@/lib/local-auth';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { countActionBadge } from '@/lib/project/repository';
import { localDateString } from '@/lib/project/date';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!hasLocalPassword()) redirect('/setup');
  if (!(await hasLocalSession())) redirect('/unlock');

  const todayBadge = countActionBadge(localDateString());

  return (
    <DashboardShell userEmail="本地用户" todayBadge={todayBadge}>
      {children}
    </DashboardShell>
  );
}
