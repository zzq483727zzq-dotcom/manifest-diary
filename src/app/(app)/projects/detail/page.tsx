'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProjectBoard } from '@/components/project/ProjectBoard';
import { getProjectSummary, listTasks } from '@/lib/store/repository';
import { useStore } from '@/lib/store/useStore';

function ProjectDetailContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id') ?? '';
  const initialTaskId = searchParams.get('task') ?? undefined;
  const db = useStore();
  const { project, initialTasks } = useMemo(
    () => ({
      project: getProjectSummary(db, projectId),
      initialTasks: projectId ? listTasks(db, projectId) : [],
    }),
    [db, projectId],
  );

  if (!projectId || !project) {
    return (
      <div className="module-page">
        <p className="muted">项目不存在。</p>
      </div>
    );
  }

  return (
    <ProjectBoard
      project={project}
      initialTasks={initialTasks}
      initialTaskId={initialTaskId}
    />
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={null}>
      <ProjectDetailContent />
    </Suspense>
  );
}
