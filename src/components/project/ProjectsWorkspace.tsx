'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectColor, ProjectStatus, ProjectSummary } from '@/types/project';
import { PROJECT_COLORS, PROJECT_STATUS_LABELS } from '@/types/project';
import { useStore, mutate } from '@/lib/store/useStore';
import {
  createProject as createProjectRepo,
  deleteProject as deleteProjectFn,
  listProjects,
  updateProject as updateProjectFn,
  setProjectStatus as setProjectStatusFn,
} from '@/lib/store/repository';
import { parseProjectInput } from '@/lib/project/validation';

type Filter = 'active' | 'all' | 'completed' | 'archived';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'active', label: '进行中' },
  { key: 'all', label: '全部' },
  { key: 'completed', label: '已完成' },
  { key: 'archived', label: '已归档' },
];

const STATUS_MAP: Record<Filter, ProjectStatus | 'all'> = {
  active: 'active',
  all: 'all',
  completed: 'completed',
  archived: 'archived',
};

// 每种当前状态下，卡片菜单里可切换到的目标状态及其文案。
const STATUS_TRANSITIONS: Record<ProjectStatus, Array<{ status: ProjectStatus; label: string }>> = {
  active: [
    { status: 'completed', label: '标记完成' },
    { status: 'archived', label: '归档' },
  ],
  completed: [
    { status: 'active', label: '恢复进行中' },
    { status: 'archived', label: '归档' },
  ],
  archived: [
    { status: 'active', label: '恢复进行中' },
    { status: 'completed', label: '标记完成' },
  ],
};

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ProjectsWorkspace() {
  const router = useRouter();
  const db = useStore();
  const [filter, setFilter] = useState<Filter>('active');
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  // null = 创建模式；非空 = 编辑该 project（预填字段，保存不跳转）。
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<ProjectColor>(PROJECT_COLORS[0]);
  const [targetDate, setTargetDate] = useState('');
  // 项目创建表单「开始日期」默认填今天，与任务侧保持一致。
  const [startDate, setStartDate] = useState(todayLocal());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const projects = useMemo(
    () => listProjects(db, STATUS_MAP[filter]),
    [db, filter],
  );

  const emptyCopy = useMemo(() => {
    if (filter === 'active') {
      return {
        title: '还没有进行中的项目',
        body: '把一个想完成的事情变成可执行的项目，进度、截止与投入都会围绕它汇总。',
        action: '创建第一个项目',
      };
    }
    return {
      title: '这个筛选下还没有项目',
      body: '换一个状态看看，或者新建一个项目，让桌面有一个起点。',
      action: '创建第一个项目',
    };
  }, [filter]);

  function openCreateDrawer() {
    setEditingProject(null);
    setName('');
    setDescription('');
    setColor(PROJECT_COLORS[0]);
    setTargetDate('');
    setStartDate(todayLocal());
    setFormError('');
    setDrawerOpen(true);
  }

  function openEditDrawer(project: ProjectSummary) {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description);
    setColor(project.color);
    setTargetDate(project.target_date ?? '');
    setStartDate(project.start_date ?? '');
    setFormError('');
    setMenuId(null);
    setDrawerOpen(true);
  }

  function submitProjectForm(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const input = parseProjectInput({
        name,
        description,
        color,
        target_date: targetDate || null,
        start_date: startDate || null,
      });
      if (editingProject) {
        mutate((draft) => {
          updateProjectFn(draft, editingProject.id, input);
        });
        setDrawerOpen(false);
      } else {
        let createdId = '';
        mutate((draft) => {
          const created = createProjectRepo(draft, input);
          createdId = created.id;
        });
        setDrawerOpen(false);
        router.push(`/projects/detail?id=${createdId}`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  function changeProjectStatus(project: ProjectSummary, status: ProjectStatus) {
    setMenuId(null);
    try {
      mutate((draft) => {
        setProjectStatusFn(draft, project.id, status);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '状态更新失败');
    }
  }

  function deleteProject(project: ProjectSummary) {
    if (!window.confirm(`确定删除项目「${project.name}」吗？项目下的任务、子任务和耗时记录都会一起删除，且无法撤销。`)) {
      return;
    }
    setDeletingId(project.id);
    setMenuId(null);
    try {
      mutate((draft) => {
        deleteProjectFn(draft, project.id);
      });
      router.push('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (menuId == null) return;
    const close = () => setMenuId(null);
    window.addEventListener('click', close);
    window.addEventListener('focus', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('focus', close, true);
    };
  }, [menuId]);

  return (
    <div className="module-page">
      <header className="module-header projects-header">
        <div>
          <h1>把想完成的事情变成可执行项目</h1>
          <p>先建项目，再拆任务。进度、截止日期和投入都会围绕项目汇总。</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={openCreateDrawer}
        >
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

      {projects.length === 0 ? (
        <article className="projects-empty">
          <span className="projects-empty-mark" aria-hidden />
          <h2>{emptyCopy.title}</h2>
          <p>{emptyCopy.body}</p>
          <button
            type="button"
            className="primary-button"
            onClick={openCreateDrawer}
          >
            {emptyCopy.action}
          </button>
        </article>
      ) : (
        <div className="module-grid projects-grid">
          {projects.map((project) => {
            const pct = Math.round(project.progress * 100);
            const hasTasks = project.task_total > 0;
            const menuOpen = menuId === project.id;
            return (
              <div
                key={project.id}
                className="life-card project-card"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/projects/detail?id=${project.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    router.push(`/projects/detail?id=${project.id}`);
                  }
                }}
              >
                <span className="project-card-rail" style={{ background: project.color }} aria-hidden />
                <div className="project-card-body">
                  <div className="project-card-head">
                    <span className={`project-status-pill project-status-${project.status}`}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                    <div className="project-card-head-right">
                      {hasTasks ? (
                        <span className="project-progress-value" data-progress={pct}>
                          {pct}%
                        </span>
                      ) : null}
                      <div className="project-card-menu">
                        <button
                          type="button"
                          className="project-card-menu-trigger"
                          aria-label="项目菜单"
                          aria-haspopup="menu"
                          aria-expanded={menuOpen}
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuId(menuOpen ? null : project.id);
                          }}
                        >
                          ⋯
                        </button>
                        {menuOpen ? (
                          <div
                            className="project-card-menu-pop"
                            role="menu"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="project-card-menu-item"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditDrawer(project);
                              }}
                            >
                              编辑项目
                            </button>
                            {STATUS_TRANSITIONS[project.status].map((opt) => (
                              <button
                                key={opt.status}
                                type="button"
                                className="project-card-menu-item"
                                role="menuitem"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  changeProjectStatus(project, opt.status);
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="project-card-menu-item danger-text"
                              role="menuitem"
                              disabled={deletingId === project.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteProject(project);
                              }}
                            >
                              {deletingId === project.id ? '删除中…' : '删除项目'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <h2 className="project-card-name">{project.name}</h2>
                  {project.description ? <p className="project-desc">{project.description}</p> : null}
                  <div className="progress-track" aria-hidden>
                    <div
                      className="progress-fill"
                      style={{ width: `${hasTasks ? pct : 0}%` }}
                    />
                  </div>
                  <div className="project-meta">
                    <span className="project-meta-cell">
                      <span className="project-meta-label">进度</span>
                      <span className="project-meta-value">
                        {project.task_completed}/{project.task_total} 个任务
                      </span>
                    </span>
                    <span className="project-meta-cell project-meta-due">
                      <span className="project-meta-label">最近截止</span>
                      <span className="project-meta-value project-meta-due-value">
                        {project.nearest_due_date ? project.nearest_due_date : '暂无日期'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
            <h2 id="create-project-title">
              {editingProject ? '编辑项目' : '创建一个可执行项目'}
            </h2>
            <form className="stack-form" onSubmit={submitProjectForm}>
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
                开始日期（可选）
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
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
                {saving
                  ? editingProject
                    ? '保存中…'
                    : '创建中…'
                  : editingProject
                    ? '保存'
                    : '创建项目'}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
