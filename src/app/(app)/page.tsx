import {
  getWeekStats,
  listProjects,
  listTodayGroups,
} from '@/lib/project/repository';
import { localDateString } from '@/lib/project/date';
import { TodayDesk } from '@/components/project/TodayDesk';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const today = localDateString();
  const groups = listTodayGroups(today);
  const stats = getWeekStats(today);
  const projects = listProjects('active');

  return <TodayDesk groups={groups} stats={stats} projects={projects} />;
}
