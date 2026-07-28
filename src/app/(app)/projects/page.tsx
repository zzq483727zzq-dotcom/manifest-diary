import Link from 'next/link';
import { listProjects } from '@/lib/project/repository';
import { PROJECT_STATUS_LABELS } from '@/types/project';

export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  const projects = listProjects('active');

  return (
    <div className="module-page">
      <header className="module-header">
        <div className="eyebrow">项目 · PROJECTS</div>
        <h1>把想完成的事情变成可执行项目。</h1>
        <p>第一版先支持查看进行中项目。创建抽屉和完整筛选会在下一张工单接入。</p>
      </header>

      {projects.length === 0 ? (
        <article className="life-card module-note">
          <div className="eyebrow">空状态</div>
          <h2>还没有进行中的项目</h2>
          <p>下一张工单会补上创建项目抽屉。现在数据底座和导航已经切到项目系统。</p>
        </article>
      ) : (
        <div className="module-grid">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="life-card">
              <div className="eyebrow" style={{ color: project.color }}>
                {PROJECT_STATUS_LABELS[project.status]}
              </div>
              <h2 style={{ marginTop: 12, fontSize: 22 }}>{project.name}</h2>
              <p style={{ color: 'var(--life-muted)', marginTop: 8 }}>
                进度 {project.task_completed}/{project.task_total} · {Math.round(project.progress * 100)}%
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
