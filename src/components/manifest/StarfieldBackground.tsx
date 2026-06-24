"use client";
import { useEffect, useRef } from "react";

interface Star {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  glowRadius: number;
  isRose: boolean;
}

interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  phase: number;
}

interface Meteor {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  life: number;
  maxLife: number;
}

interface StarfieldBackgroundProps {
  /** When true, stars and dust gently converge toward the screen center and brighten. */
  isTyping?: boolean;
}

export function StarfieldBackground({ isTyping = false }: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep the latest isTyping in a ref so the animation loop reads fresh values
  // without restarting on every prop change.
  const typingRef = useRef(isTyping);
  typingRef.current = isTyping;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stars: Star[] = [];
    const dust: Dust[] = [];
    // Pre-allocated meteor pool — never `new` per frame.
    const METEOR_POOL = 4;
    const meteors: Meteor[] = Array.from({ length: METEOR_POOL }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      length: 0,
      life: 0,
      maxLife: 0,
    }));
    const STAR_COUNT = 120;
    const DUST_COUNT = 40;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }

    function initStars() {
      stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        const size = Math.random() * 2 + 0.5;
        const baseX = Math.random() * canvas!.width;
        const baseY = Math.random() * canvas!.height;
        stars.push({
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          size,
          opacity: Math.random() * 0.7 + 0.25,
          speed: Math.random() * 0.005 + 0.002,
          glowRadius: size * 3,
          // ~15% of stars get a warm-gold tint (gold-bright)
          isRose: Math.random() < 0.15,
        });
      }
    }

    function initDust() {
      dust.length = 0;
      for (let i = 0; i < DUST_COUNT; i++) {
        dust.push({
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          // Very slow drift
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.08,
          size: Math.random() * 0.8 + 0.2,
          opacity: Math.random() * 0.35 + 0.1,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    function spawnMeteor() {
      const m = meteors.find((x) => !x.active);
      if (!m) return;
      // Spawn near the top, right of the canvas. Travel down-left.
      const startX = canvas!.width * (0.5 + Math.random() * 0.6);
      const startY = -20 - Math.random() * 80;
      const speed = 6 + Math.random() * 4;
      // Steep down-left vector: negative x, positive y (vy larger for steeper fall)
      const angle = Math.PI * (0.15 + Math.random() * 0.15); // ~27°–54°
      m.vx = -Math.cos(angle) * speed; // negative x (leftward)
      m.vy = Math.sin(angle) * speed * 1.4; // positive y (downward), steeper
      m.x = startX;
      m.y = startY;
      m.length = 80 + Math.random() * 60;
      m.maxLife = 60 + Math.random() * 30;
      m.life = m.maxLife;
      m.active = true;
    }

    let animationId = 0;
    let time = 0;
    let nextMeteorAt = performance.now() + 3000 + Math.random() * 5000;

    function animate() {
      if (!ctx || !canvas) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      time += 1;

      const typing = typingRef.current;
      const cx = w / 2;
      const cy = h / 2;
      // Convergence factor: how far each star/dust pulls toward center when typing.
      const convergence = typing ? 0.04 : 0;
      const brightnessBoost = typing ? 1.25 : 1;

      // --- Stardust (drawn behind stars) ---
      for (const d of dust) {
        d.x += d.vx;
        d.y += d.vy;
        if (typing) {
          d.x += (cx - d.x) * 0.0015;
          d.y += (cy - d.y) * 0.0015;
        }
        if (d.x < -5) d.x = w + 5;
        else if (d.x > w + 5) d.x = -5;
        if (d.y < -5) d.y = h + 5;
        else if (d.y > h + 5) d.y = -5;

        const breath = Math.sin(time * 0.01 + d.phase) * 0.3 + 0.7;
        const alpha = d.opacity * breath * brightnessBoost;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 230, 211, ${Math.min(alpha, 0.5)})`;
        ctx.fill();
      }

      // --- Stars ---
      for (const star of stars) {
        const targetX = star.baseX + (cx - star.baseX) * convergence;
        const targetY = star.baseY + (cy - star.baseY) * convergence;
        star.x += (targetX - star.x) * 0.05;
        star.y += (targetY - star.y) * 0.05;

        const twinkle = Math.sin(time * star.speed) * 0.3 + 0.7;
        const opacity = Math.min(star.opacity * twinkle * brightnessBoost, 1);

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        if (star.isRose) {
          // Warm gold star (var(--gold-bright) ≈ #f5d77a)
          ctx.fillStyle = `rgba(245, 215, 122, ${opacity})`;
        } else {
          ctx.fillStyle = `rgba(255, 224, 200, ${opacity})`;
        }
        ctx.fill();

        if (star.size > 1.5) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = star.isRose
            ? `rgba(212, 175, 55, ${opacity * 0.22})`
            : `rgba(245, 215, 122, ${opacity * 0.14})`;
          ctx.fill();
        }
      }

      // --- Meteors ---
      const now = performance.now();
      if (now >= nextMeteorAt) {
        spawnMeteor();
        // Every 3–8 seconds a new meteor.
        nextMeteorAt = now + 3000 + Math.random() * 5000;
      }
      for (const m of meteors) {
        if (!m.active) continue;
        m.x += m.vx;
        m.y += m.vy;
        m.life -= 1;
        const lifeRatio = m.life / m.maxLife;
        const fade = Math.max(0, lifeRatio);

        // Head
        const headAlpha = 0.95 * fade;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 235, 220, ${headAlpha})`;
        ctx.fill();

        // Tail — linear gradient along velocity direction
        const speedMag = Math.hypot(m.vx, m.vy) || 1;
        const tailX = m.x - (m.vx / speedMag) * m.length;
        const tailY = m.y - (m.vy / speedMag) * m.length;
        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 235, 220, ${0.85 * fade})`);
        grad.addColorStop(0.4, `rgba(245, 215, 122, ${0.45 * fade})`);
        grad.addColorStop(1, `rgba(212, 175, 55, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        if (
          m.life <= 0 ||
          m.x < -200 ||
          m.x > w + 200 ||
          m.y < -200 ||
          m.y > h + 200
        ) {
          m.active = false;
        }
      }

      animationId = requestAnimationFrame(animate);
    }

    function handleResize() {
      resize();
      initStars();
      initDust();
    }

    resize();
    initStars();
    initDust();
    animate();
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
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
