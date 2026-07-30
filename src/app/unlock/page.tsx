'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Static build: no password lock. The unlock page existed only to verify the
 * local password in the SQLite-backed build; in the static export it is a
 * no-op that bounces visitors straight into the workbench. Kept (rather than
 * deleted) so any lingering bookmark doesn't 404.
 */
export default function UnlockPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
