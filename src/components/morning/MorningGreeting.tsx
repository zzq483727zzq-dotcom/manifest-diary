interface MorningGreetingProps {
  greeting: string;
  date: string;
  hasScript: boolean;
  completionRate: number;
}

export function MorningGreeting({ greeting, date, hasScript, completionRate }: MorningGreetingProps) {
  return (
    <header className="text-center py-8 animate-fade-in">
      <p className="text-meta">{date}</p>
      <h1
        className="text-3xl font-light mt-3"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}
      >
        {greeting}
        <span className="text-gold"> ✦</span>
      </h1>
      <p
        className="mt-3 text-sm font-ai"
        style={{ color: 'var(--text-secondary)' }}
      >
        {hasScript
          ? completionRate === 1
            ? '昨晚的你，今天全都接住了。'
            : '昨晚的你给今天的你，留了几步路。'
          : '今夜还没写——什么时候想倒，随时来。'}
      </p>
    </header>
  );
}
