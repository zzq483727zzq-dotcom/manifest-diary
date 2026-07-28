'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectColor, ProjectSummary } from '@/types/project';
import { PROJECT_COLORS, PROJECT_STATUS_LABELS } from '@/types/project';

type Filter = 'active' | 'all' | 'completed' | 'archived';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'active', label: '进行中' },
  { key: 'all', label: '全部' },
  { key: 'completed', label: '已完成' },
  { key: 'archived', label: '已归档' },
];

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ProjectsWorkspace() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('active');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<ProjectColor>(PROJECT_COLORS[0]);
  const [targetDate, setTargetDate] = useState('');

  async function load(nextFilter = filter) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/projects?status=${nextFilter}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '加载项目失败');
      setProjects(body.projects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const emptyCopy = useMemo(() => {
    if (filter === 'active') {
      return {
        title: '还没有进行中的项目',
        body: '把一个想完成的事情变成可执行的项目。',
      };
    }
    return {
      title: '这个筛选下没有项目',
      body: '换一个状态看看，或者新建一个项目。',
    };
  }, [filter]);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          color,
          target_date: targetDate || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '创建失败');
      setDrawerOpen(false);
      setName('');
      setDescription('');
      setColor(PROJECT_COLORS[0]);
      setTargetDate('');
      router.push(`/projects/${body.project.id}`);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <header className="module-header projects-header">
        <div>
          <div className="eyebrow">项目 · PROJECTS</div>
          <h1>把想完成的事情变成可执行项目。</h1>
          <p>先建项目，再拆任务。进度、截止日期和投入都会围绕项目汇总。</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setDrawerOpen(true)}>
          新建项目
        </button>
      </header>

      <div className="filter-row">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={filter === item.key ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <div className="module-grid">
          <div className="life-card skeleton-card" />
          <div className="life-card skeleton-card" />
        </div>
      ) : projects.length === 0 ? (
        <article className="life-card module-note">
          <div className="eyebrow">空状态</div>
          <h2>{emptyCopy.title}</h2>
          <p>{emptyCopy.body}</p>
          <p style={{ marginTop: 16 }}>
            <button type="button" className="primary-button" onClick={() => setDrawerOpen(true)}>
              创建第一个项目
            </button>
          </p>
        </article>
      ) : (
        <div className="module-grid">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className="life-card project-card"
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              <div className="project-card-top">
                <span className="project-color" style={{ background: project.color }} />
                <span className="eyebrow">{PROJECT_STATUS_LABELS[project.status]}</span>
              </div>
              <h2>{project.name}</h2>
              {project.description ? <p className="project-desc">{project.description}</p> : null}
              <div className="project-meta">
                <span>
                  进度 {project.task_completed}/{project.task_total} · {Math.round(project.progress * 100)}%
                </span>
                <span>
                  {project.nearest_due_date
                    ? `最近截止 ${project.nearest_due_date}`
                    : '无截止日期'}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.round(project.progress * 100)}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}

      {drawerOpen ? (
        <div className="sheet-backdrop" onMouseDown={() => !saving && setDrawerOpen(false)}>
          <section
            className="drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="sheet-close"
              onClick={() => !saving && setDrawerOpen(false)}
              aria-label="关闭"
            >
              ×
            </button>
            <div className="eyebrow">新建项目</div>
            <h2 id="create-project-title">创建一个可执行项目</h2>
            <form className="stack-form" onSubmit={createProject}>
              <label>
                项目名称
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：作品集改版"
                  maxLength={80}
                  autoFocus
                  required
                />
              </label>
              <label>
                描述（可选）
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="这个项目要完成什么"
                  rows={4}
                  maxLength={2000}
                />
              </label>
              <div>
                <div className="field-label">颜色</div>
                <div className="color-row">
                  {PROJECT_COLORS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={color === item ? 'color-swatch active' : 'color-swatch'}
                      style={{ background: item }}
                      onClick={() => setColor(item)}
                      aria-label={`选择颜色 ${item}`}
                    />
                  ))}
                </div>
              </div>
              <label>
                目标日期（可选）
                <input
                  type="date"
                  value={targetDate}
                  min={todayLocal()}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </label>
              {formError ? <p className="form-error">{formError}</p> : null}
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? '创建中…' : '创建项目'}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
