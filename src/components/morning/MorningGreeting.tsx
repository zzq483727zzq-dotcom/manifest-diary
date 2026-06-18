'use client';

interface MorningGreetingProps {
  hasScript: boolean;
  date: string;
}

export function MorningGreeting({ hasScript, date }: MorningGreetingProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 9 ? '早安' : hour < 18 ? '下午好' : '晚上好';

  return (
    <header className="text-center py-6">
      <p className="text-xs tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        {date}
      </p>
      <h1
        className="text-3xl font-light mt-2"
        style={{ color: 'var(--text-primary)', fontFamily: 'serif' }}
      >
        {greeting}，今天是你的一天 ✨
      </h1>
      {hasScript && (
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          昨晚的你给今天的你留了几步路
        </p>
      )}
    </header>
  );
}