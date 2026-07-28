import Link from 'next/link';
import { listProjects } from '@/lib/project/repository';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const projects = listProjects('active');

  return (
    <div className="module-page">
      <header className="module-header">
        <div className="eyebrow">今日 · ACTION DESK</div>
        <h1>今天先推进最重要的项目。</h1>
        <p>先把要做的事情放进项目，再从今日行动台持续推进。</p>
      </header>

      {projects.length === 0 ? (
        <article className="life-card module-note">
          <div className="eyebrow">开始</div>
          <h2>还没有进行中的项目</h2>
          <p>把一个想完成的事情变成可执行的项目。</p>
          <p style={{ marginTop: 18 }}>
            <Link className="primary-link" href="/projects">
              创建第一个项目 →
            </Link>
          </p>
        </article>
      ) : (
        <div className="module-grid">
          <article className="life-card module-note">
            <div className="eyebrow">进行中项目</div>
            <h2>{projects.length} 个项目正在推进</h2>
            <p>任务看板、今日分组和日历会在后续工单接入。现在可以先管理项目。</p>
            <p style={{ marginTop: 18 }}>
              <Link className="primary-link" href="/projects">
                查看项目 →
              </Link>
            </p>
          </article>
          <article className="life-card module-note">
            <div className="eyebrow">下一步</div>
            <h2>进入项目，添加第一条任务</h2>
            <p>任务必须归属项目。这能避免待办堆积，让执行始终围绕项目完成。</p>
          </article>
        </div>
      )}
    </div>
  );
}
