/**
 * LampGlow — fixed-position warm lamp glow that sits behind every page.
 * Top-left warm orange light source. Provides the "desk lamp" warmth that
 * the visual redesign calls for, without lighting up the whole screen.
 */
export function LampGlow() {
  return (
    <>
      {/* Top-left lamp halo */}
      <div
        aria-hidden
        className="fixed pointer-events-none"
        style={{
          top: '-15%',
          left: '-10%',
          width: '50%',
          height: '55%',
          background:
            'radial-gradient(ellipse at center, rgba(245,166,35,0.20) 0%, rgba(245,166,35,0.04) 42%, transparent 70%)',
          filter: 'blur(10px)',
          zIndex: 0,
        }}
      />
      {/* Bottom-right cool purple ambience for cold/warm balance */}
      <div
        aria-hidden
        className="fixed pointer-events-none"
        style={{
          bottom: '-18%',
          right: '-12%',
          width: '46%',
          height: '46%',
          background:
            'radial-gradient(ellipse at center, rgba(90,70,190,0.14) 0%, rgba(120,90,200,0.04) 45%, transparent 70%)',
          filter: 'blur(12px)',
          zIndex: 0,
        }}
      />
    </>
  );
}