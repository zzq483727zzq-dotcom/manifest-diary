import { describe, expect, it } from 'vitest';
import { parseProjectInput, parseTaskInput, parseTimeEntryInput } from '@/lib/project/validation';

describe('project validation', () => {
  it('requires project name', () => {
    expect(() => parseProjectInput({ name: '   ' })).toThrow('项目名称不能为空');
  });

  it('parses project defaults', () => {
    const project = parseProjectInput({ name: '作品集改版' });
    expect(project.name).toBe('作品集改版');
    expect(project.color).toBe('#5EEAD4');
    expect(project.target_date).toBeNull();
  });

  it('requires task project and title', () => {
    expect(() => parseTaskInput({ title: '写首页' })).toThrow('项目不能为空');
    const task = parseTaskInput({ project_id: 'p1', title: '写首页' });
    expect(task).toMatchObject({
      project_id: 'p1',
      title: '写首页',
      status: 'todo',
      priority: 'medium',
    });
  });

  it('parses task focus target minutes', () => {
    const task = parseTaskInput({ project_id: 'p1', title: '写首页', target_minutes: 45 });
    expect(task).toMatchObject({ target_minutes: 45 });
  });
  it('validates time entry bounds', () => {
    expect(() => parseTimeEntryInput({ minutes: 0 }, '2026-07-28')).toThrow('1–1440');
    expect(() => parseTimeEntryInput({ minutes: 30, logged_date: '2099-01-01' }, '2026-07-28')).toThrow(
      '不能记录未来日期的耗时',
    );
    expect(parseTimeEntryInput({ minutes: 45 }, '2026-07-28')).toEqual({
      minutes: 45,
      logged_date: '2026-07-28',
      note: '',
    });
  });
});
