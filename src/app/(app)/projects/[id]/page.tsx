import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectSummary, listTasks } from '@/lib/project/repository';
import { PROJECT_STATUS_LABELS, TASK_STATUS_LABELS } from '@/types/project';
import { formatMinutes } from '@/lib/project/date';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const project = getProjectSummary(id);
  if (!project) notFound();
  const tasks = listTasks(id);

  return (
    <div className="module-page">
      <header className="module-header">
        <Link href="/projects" className="eyebrow">
          ← 返回项目
        </Link>
        <h1>{project.name}</h1>
        <p>
          {PROJECT_STATUS_LABELS[project.status]} · 进度 {project.task_completed}/{project.task_total} · 累计{' '}
          {formatMinutes(project.minutes_total)}
        </p>
        {project.description ? <p>{project.description}</p> : null}
      </header>

      <article className="life-card module-note">
        <div className="eyebrow">下一张工单</div>
        <h2>任务看板与详情抽屉即将接入</h2>
        <p>现在项目详情已可打开。当前任务数：{tasks.length}。完整看板/列表会在工单 03 完成。</p>
        {tasks.length > 0 ? (
          <ul style={{ marginTop: 16, color: 'var(--life-muted)', lineHeight: 1.8 }}>
            {tasks.slice(0, 8).map((task) => (
              <li key={task.id}>
                {task.title} · {TASK_STATUS_LABELS[task.status]}
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </div>
  );
}
