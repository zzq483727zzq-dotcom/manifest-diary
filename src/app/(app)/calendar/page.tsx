import Link from 'next/link';

export default function CalendarPlaceholderPage() {
  return (
    <div className="module-page">
      <header className="module-header">
        <div className="eyebrow">日历 · CALENDAR</div>
        <h1>按截止日期规划项目任务。</h1>
        <p>月视图和周视图会在日历工单中接入。现在导航和数据底座已就绪。</p>
      </header>
      <article className="life-card module-note">
        <h2>日历即将到来</h2>
        <p>先创建项目和任务，再回来看截止日期分布。</p>
        <p style={{ marginTop: 16 }}>
          <Link className="primary-link" href="/projects">
            先去项目 →
          </Link>
        </p>
      </article>
    </div>
  );
}
