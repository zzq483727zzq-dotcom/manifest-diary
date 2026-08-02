'use client';

import { useMemo } from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store/useStore';
import { listProjects, listTasks } from '@/lib/store/repository';
import { localDateString } from '@/lib/project/date';
import { CalendarWorkspace } from '@/components/project/CalendarWorkspace';

function CalendarBody() {
  const searchParams = useSearchParams();
  const db = useStore();
  const today = localDateString();
  const [ty, tm] = today.split('-').map(Number);
  const year = Number(searchParams.get('year')) || ty;
  const month = Number(searchParams.get('month')) || tm;
  const view = searchParams.get('view') === 'week' ? 'week' : 'month';
  const filter = searchParams.get('filter') === 'open' ? 'open' : 'all';
  const day = searchParams.get('day') ?? undefined;

  const tasks = useMemo(
    () => listTasks(db).filter((task) => task.project_status !== 'archived'),
    [db],
  );
  // 仅用于日面板里的内联建任务表单：选择项目的下拉。
  const activeProjects = useMemo(
    () => listProjects(db, 'active'),
    [db],
  );

  return (
    <CalendarWorkspace
      tasks={tasks}
      projects={activeProjects}
      initialYear={year}
      initialMonth={month}
      initialView={view}
      initialFilter={filter}
      initialSelected={day}
    />
  );
}

export default function CalendarPage() {
  // `useSearchParams` requires a Suspense boundary in a statically rendered page.
  return (
    <Suspense fallback={null}>
      <CalendarBody />
    </Suspense>
  );
}
