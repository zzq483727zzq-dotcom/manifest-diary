import { notFound } from 'next/navigation';
import { getProjectSummary, listTasks } from '@/lib/project/repository';
import { ProjectBoard } from '@/components/project/ProjectBoard';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ task?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const project = getProjectSummary(id);
  if (!project) notFound();
  const tasks = listTasks(id);

  return <ProjectBoard project={project} initialTasks={tasks} initialTaskId={query.task} />;
}
