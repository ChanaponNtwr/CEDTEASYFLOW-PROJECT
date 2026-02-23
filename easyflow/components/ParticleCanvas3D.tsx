// components/ParticleCanvas3D.tsx
"use client";
import React, { useEffect, useRef } from "react";

// Types
type ParticleCanvasProps = { enabled?: boolean; amount?: number };

interface Particle {
  baseAngle: number;
  radius: number;
  thetaSpeed: number;
  phase: number;
  zAmp: number;
  zBase: number;
  size: number;
  hue: number;
  x: number;
  y: number;
  z: number;
}

// Utility
function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

// ParticleCanvas3D: simulates 3D swinging/oscillating particles that follow the mouse
export default function ParticleCanvas3D({ enabled = true, amount = 120 }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointer = useRef({ x: 0, y: 0 }); 
  const pointerTarget = useRef({ x: 0, y: 0 }); 
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Narrow types once (assert non-null) and use the non-null variables throughout.
    const canvasEl = canvas as HTMLCanvasElement;
    const ctx2 = ctx as CanvasRenderingContext2D;

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;

    function resize() {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      w = canvasEl.clientWidth || 0;
      h = canvasEl.clientHeight || 0;
      cx = w / 2;
      cy = h / 2;
      canvasEl.width = Math.max(1, Math.floor(w * dpr));
      canvasEl.height = Math.max(1, Math.floor(h * dpr));
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initParticles() {
      const particles: Particle[] = new Array(amount).fill(0).map(() => {
        const baseAngle = Math.random() * Math.PI * 2;
        const radius = rand(40, Math.max(w, h) * 0.55); 
        const thetaSpeed = rand(0.00006, 0.00045); 
        const phase = Math.random() * Math.PI * 2;
        const zAmp = rand(40, 220); 
        const zBase = rand(-200, 200);
        const size = rand(0.6, 2.2);
        const hue = Math.floor(rand(200, 60));
        return {
          baseAngle,
          radius,
          thetaSpeed,
          phase,
          zAmp,
          zBase,
          size,
          hue,
          x: cx,
          y: cy,
          z: 0,
        };
      });
      particlesRef.current = particles;
    }

    function onPointerMove(e: PointerEvent) {
      pointerTarget.current.x = (e.clientX - cx) / Math.max(1, Math.min(cx, 600));
      pointerTarget.current.y = (e.clientY - cy) / Math.max(1, Math.min(cy, 600));
    }

    function step(ts: number) {
      const dt = ts - timeRef.current || 16;
      timeRef.current = ts;

      pointer.current.x += (pointerTarget.current.x - pointer.current.x) * 0.05;
      pointer.current.y += (pointerTarget.current.y - pointer.current.y) * 0.05;

      ctx2.clearRect(0, 0, w, h);

      const tiltX = pointer.current.y * 0.45; 
      const tiltY = pointer.current.x * -0.6; 

      const perspective = Math.max(400, Math.min(1400, Math.max(w, h)));

      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];

        p.baseAngle += p.thetaSpeed * dt;

        const localX = Math.cos(p.baseAngle + p.phase) * p.radius;
        const localY = Math.sin(p.baseAngle + p.phase) * (p.radius * 0.35);

        const z = Math.sin((p.baseAngle + p.phase) * 1.5) * p.zAmp + p.zBase;

        const rotY = tiltY * 0.5;
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        let rx = localX * cosY + z * sinY;
        let rz = -localX * sinY + z * cosY;

        const rotX = tiltX * 0.5;
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        let ry = localY * cosX - rz * sinX;
        let rz2 = localY * sinX + rz * cosX;

        const scale = perspective / (perspective + rz2);
        const screenX = cx + (rx + pointer.current.x * 60) * scale;
        const screenY = cy + (ry + pointer.current.y * 60) * scale;

        p.x += (screenX - p.x) * 0.05;
        p.y += (screenY - p.y) * 0.05;
        p.z = rz2;

        const s = Math.max(0.14, scale) * p.size * 1.0;
        const alpha = Math.max(0.045, Math.min(1, (1 - (p.z + 600) / 1200) * 1.0));

        ctx2.beginPath();
        ctx2.globalAlpha = alpha;
        ctx2.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx2.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx2.fill();

        if (alpha > 0.08) {
          ctx2.beginPath();
          ctx2.globalAlpha = alpha * 0.06;
          ctx2.fillStyle = `rgba(255,255,255,1)`;
          ctx2.arc(p.x, p.y, s * 6, 0, Math.PI * 2);
          ctx2.fill();
        }
      }

      ctx2.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(step);
    }

    resize();
    initParticles();
    timeRef.current = performance.now();

    pointer.current.x = 0;
    pointer.current.y = 0;
    pointerTarget.current.x = 0;
    pointerTarget.current.y = 0;

    window.addEventListener('resize', resize);
    document.addEventListener('pointermove', onPointerMove as EventListener);

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('pointermove', onPointerMove as EventListener);
    };
  }, [enabled, amount]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-5"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}