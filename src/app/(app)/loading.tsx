/**
 * Route-level loading UI for the (app) route group. Shown immediately when
 * the user clicks a NavBar link, so the browser never sits on a "stale" page
 * feeling like nothing is happening. Replaced once the new page's data
 * finishes loading.
 */
export default function Loading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ backgroundColor: 'var(--bg-solid)' }}
    >
      <div
        className="breathe text-gold"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '2.5rem',
          lineHeight: 1,
        }}
      >
        ✦
      </div>
      <p
        className="text-xs"
        style={{
          color: 'var(--text-secondary)',
          letterSpacing: '0.2em',
          opacity: 0.7,
        }}
      >
        正在加载
      </p>
    </div>
  );
}