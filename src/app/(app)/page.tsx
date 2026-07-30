'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store/useStore';
import {
  getWeekStats,
  listProjects,
  listTodayGroups,
} from '@/lib/store/repository';
import { localDateString } from '@/lib/project/date';
import { TodayDesk } from '@/components/project/TodayDesk';

export default function HomePage() {
  const db = useStore();
  const today = localDateString();

  const { groups, stats, projects } = useMemo(() => {
    return {
      groups: listTodayGroups(db, today),
      stats: getWeekStats(db, today),
      projects: listProjects(db, 'active'),
    };
  }, [db, today]);

  return <TodayDesk groups={groups} stats={stats} projects={projects} />;
}
