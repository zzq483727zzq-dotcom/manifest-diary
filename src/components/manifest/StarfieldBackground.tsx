"use client";
import { useEffect, useRef } from "react";

interface Star { x: number; y: number; size: number; opacity: number; speed: number; glowRadius: number; }

export function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stars: Star[] = [];
    const STAR_COUNT = 120;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }

    function initStars() {
      stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        const size = Math.random() * 2 + 0.5;
        stars.push({
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          size,
          opacity: Math.random() * 0.8 + 0.2,
          speed: Math.random() * 0.005 + 0.002,
          glowRadius: size * 3,
        });
      }
    }

    function handleResize() {
      resize();
      initStars();
    }

    let animationId = 0;
    let time = 0;

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 1;

      for (const star of stars) {
        const twinkle = Math.sin(time * star.speed) * 0.3 + 0.7;
        const opacity = star.opacity * twinkle;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 220, 200, ${opacity})`;
        ctx.fill();

        // Bright stars get a simple semi-transparent halo instead of a per-frame gradient.
        if (star.size > 1.5) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 182, 193, ${opacity * 0.12})`;
          ctx.fill();
        }
      }
      animationId = requestAnimationFrame(animate);
    }

    resize();
    initStars();
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
