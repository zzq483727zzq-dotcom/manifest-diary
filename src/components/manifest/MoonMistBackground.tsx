'use client';

import { useEffect, useRef } from 'react';

interface MistParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  phase: number;
}

interface MoonMistBackgroundProps {
  /** When true, mist particles brighten and move more actively. */
  isTyping?: boolean;
}

export function MoonMistBackground({ isTyping = false }: MoonMistBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const typingRef = useRef(isTyping);
  typingRef.current = isTyping;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }

    const MIST_COUNT = 40;
    const particles: MistParticle[] = Array.from({ length: MIST_COUNT }, () => ({
      x: Math.random() * (canvas!.width || window.innerWidth),
      y: Math.random() * (canvas!.height || window.innerHeight),
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.2 - 0.05,
      radius: Math.random() * 120 + 60,
      opacity: Math.random() * 0.06 + 0.02,
      phase: Math.random() * Math.PI * 2,
    }));

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      ctx!.clearRect(0, 0, w, h);

      // Deep purple-black cosmos background gradient
      const bg = ctx!.createRadialGradient(w * 0.7, h * 0.15, 0, w * 0.5, h * 0.5, w * 0.8);
      bg.addColorStop(0, 'rgba(80, 50, 100, 0.5)');
      bg.addColorStop(0.5, 'rgba(30, 20, 50, 0.3)');
      bg.addColorStop(1, 'rgba(10, 5, 20, 0)');
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, w, h);

      // Moon glow - top right
      const moonX = w * 0.78;
      const moonY = h * 0.18;
      const moonGlow = ctx!.createRadialGradient(moonX, moonY, 0, moonX, moonY, 180);
      moonGlow.addColorStop(0, 'rgba(245, 235, 210, 0.25)');
      moonGlow.addColorStop(0.3, 'rgba(220, 200, 170, 0.12)');
      moonGlow.addColorStop(1, 'rgba(200, 180, 150, 0)');
      ctx!.fillStyle = moonGlow;
      ctx!.beginPath();
      ctx!.arc(moonX, moonY, 180, 0, Math.PI * 2);
      ctx!.fill();

      // Mist particles
      const typing = typingRef.current;
      time += 0.003;

      for (const p of particles) {
        const ox = Math.sin(time + p.phase) * 15;
        const oy = Math.cos(time * 0.7 + p.phase) * 10;
        const baseAlpha = typing ? p.opacity * 1.4 : p.opacity;
        const alpha = baseAlpha * (0.7 + 0.3 * Math.sin(time * 0.5 + p.phase));
        const grad = ctx!.createRadialGradient(
          p.x + ox, p.y + oy, 0,
          p.x + ox, p.y + oy, p.radius
        );
        grad.addColorStop(0, `rgba(200, 190, 220, ${alpha})`);
        grad.addColorStop(0.5, `rgba(160, 150, 190, ${alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(120, 110, 160, 0)');
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(p.x + ox, p.y + oy, p.radius, 0, Math.PI * 2);
        ctx!.fill();

        // Drift
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -p.radius) {
          p.y = h + p.radius;
          p.x = Math.random() * w;
        }
        if (p.x < -p.radius) p.x = w + p.radius;
        if (p.x > w + p.radius) p.x = -p.radius;
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    draw();

    const handleResize = () => {
      resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}