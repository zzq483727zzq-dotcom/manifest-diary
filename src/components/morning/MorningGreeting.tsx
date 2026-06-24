interface MorningGreetingProps {
  greeting: string;
  date: string;
  hasScript: boolean;
  completionRate: number;
}

export function MorningGreeting({ greeting, date, hasScript }: MorningGreetingProps) {
  return (
    <header className="text-center py-10 md:py-14 animate-fade-in">
      <p className="text-meta">{date}</p>
      <h1
        className="mt-4 font-serif font-light"
        style={{
          fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
          letterSpacing: '0.08em',
          color: 'var(--text-primary)',
          lineHeight: 1.3,
        }}
      >
        {greeting}
        <span className="text-gold" style={{ marginLeft: '0.4em' }}>✦</span>
      </h1>
      {/* Subtle gold hairline — visual punctuation between headline and subline */}
      <div
        aria-hidden
        className="mx-auto mt-5 mb-4"
        style={{
          width: '2rem',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--gold-bright), transparent)',
        }}
      />
      <p
        className="font-ai text-sm"
        style={{
          color: 'var(--text-secondary)',
          opacity: 0.78,
          letterSpacing: '0.06em',
        }}
      >
        {hasScript
          ? '昨晚的你给今天的你，留了几步路。'
          : '今夜还没写——什么时候想倒，随时来。'}
      </p>
    </header>
  );
}