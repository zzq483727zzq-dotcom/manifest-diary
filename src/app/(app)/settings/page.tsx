import Link from 'next/link';

export default function SettingsPlaceholderPage() {
  return (
    <div className="module-page">
      <header className="module-header">
        <div className="eyebrow">设置 · SETTINGS</div>
        <h1>本地密码与数据备份。</h1>
        <p>修改密码、JSON 导出导入会在设置工单中完成。</p>
      </header>
      <article className="life-card module-note">
        <h2>设置页占位</h2>
        <p>当前已保留本地密码与会话，业务数据迁移到项目系统。</p>
        <p style={{ marginTop: 16 }}>
          <Link className="primary-link" href="/">
            返回今日 →
          </Link>
        </p>
      </article>
    </div>
  );
}
