export default function Loading() {
  return (
    <div className="module-page" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="eyebrow">CLARITY</div>
        <p className="muted" style={{ marginTop: 10 }}>
          正在加载工作台…
        </p>
      </div>
    </div>
  );
}
