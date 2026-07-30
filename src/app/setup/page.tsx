'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Static build: no password lock. The setup page existed only to set the
 * local password in the SQLite-backed build; in the static export it is a
 * no-op that bounces visitors straight into the workbench. The file is kept
 * (rather than deleted) so any lingering bookmark doesn't 404.
 */
export default function SetupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
