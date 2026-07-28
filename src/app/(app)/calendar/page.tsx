import { listTasks } from '@/lib/project/repository';
import { localDateString } from '@/lib/project/date';
import { CalendarWorkspace } from '@/components/project/CalendarWorkspace';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    view?: string;
    filter?: string;
    day?: string;
  }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const today = localDateString();
  const [ty, tm] = today.split('-').map(Number);
  const year = Number(query.year) || ty;
  const month = Number(query.month) || tm;
  const view = query.view === 'week' ? 'week' : 'month';
  const filter = query.filter === 'open' ? 'open' : 'all';
  const tasks = listTasks().filter((task) => task.project_status !== 'archived');

  return (
    <CalendarWorkspace
      tasks={tasks}
      initialYear={year}
      initialMonth={month}
      initialView={view}
      initialFilter={filter}
      initialSelected={query.day}
    />
  );
}
