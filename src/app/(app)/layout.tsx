import { DashboardShell } from '@/components/dashboard/DashboardShell';

/**
 * Static export build: no password lock and no per-request session (those
 * belonged to the SQLite-backed build, which read the filesystem via
 * next/headers). The workbench is open to anyone; data lives in each
 * visitor's browser localStorage.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
