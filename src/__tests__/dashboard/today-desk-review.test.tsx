import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TodayDesk } from '@/components/project/TodayDesk';

describe('TodayDesk execution review', () => {
  it('renders the review region with the default weekly range and focus metrics', () => {
    const markup = renderToStaticMarkup(
      <TodayDesk
        groups={{ overdue: [], dueToday: [], highSoon: [], inProgress: [] }}
        stats={{
          completedThisWeek: 0,
          createdOrOpenThisWeek: 0,
          completionRate: 0,
          minutesThisWeek: 0,
          activeProjects: 0,
        }}
        projects={[]}
      />,
    );

    expect(markup).toContain('aria-label="执行复盘"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('本周');
    expect(markup).toContain('任务专注');
    expect(markup).toContain('项目整体专注');
  });
});
