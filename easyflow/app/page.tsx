"use client";
import React, { useEffect, useRef } from "react";
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import { motion } from "framer-motion";

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
export function ParticleCanvas3D({ enabled = true, amount = 120 }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointer = useRef({ x: 0, y: 0 }); // smoothed pointer (screen coords)
  const pointerTarget = useRef({ x: 0, y: 0 }); // immediate pointer
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return; // guard

    const ctx = canvas.getContext('2d');
    if (!ctx) return; // guard

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;

    function resize() {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      w = canvas.clientWidth || 0;
      h = canvas.clientHeight || 0;
      cx = w / 2;
      cy = h / 2;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initParticles() {
      const particles: Particle[] = new Array(amount).fill(0).map(() => {
        const baseAngle = Math.random() * Math.PI * 2;
        const radius = rand(40, Math.max(w, h) * 0.55); // spread
        const thetaSpeed = rand(0.00006, 0.00045); // slow
        const phase = Math.random() * Math.PI * 2;
        const zAmp = rand(40, 220); // depth amplitude
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
      // pointer target relative to center (-1..1 scaled)
      pointerTarget.current.x = (e.clientX - cx) / Math.max(1, Math.min(cx, 600));
      pointerTarget.current.y = (e.clientY - cy) / Math.max(1, Math.min(cy, 600));
    }

    function step(ts: number) {
      const dt = ts - timeRef.current || 16;
      timeRef.current = ts;

      // smooth pointer (lerp)
      pointer.current.x += (pointerTarget.current.x - pointer.current.x) * 0.05;
      pointer.current.y += (pointerTarget.current.y - pointer.current.y) * 0.05;

      ctx.clearRect(0, 0, w, h);

      // tilt based on mouse to create "3D camera rotation"
      const tiltX = pointer.current.y * 0.45; // tilt up/down (smaller)
      const tiltY = pointer.current.x * -0.6; // tilt left/right (smaller)

      const perspective = Math.max(400, Math.min(1400, Math.max(w, h)));

      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];

        // advance angular position (slow)
        p.baseAngle += p.thetaSpeed * dt;

        // position in a local plane before rotation
        const localX = Math.cos(p.baseAngle + p.phase) * p.radius;
        const localY = Math.sin(p.baseAngle + p.phase) * (p.radius * 0.35);

        // z oscillation to make 3D wave
        const z = Math.sin((p.baseAngle + p.phase) * 1.5) * p.zAmp + p.zBase;

        // apply rotation from mouse tilt (small rotation around X and Y axes)
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

        // perspective projection
        const scale = perspective / (perspective + rz2);
        const screenX = cx + (rx + pointer.current.x * 60) * scale;
        const screenY = cy + (ry + pointer.current.y * 60) * scale;

        // smooth trail (inertia)
        p.x += (screenX - p.x) * 0.05;
        p.y += (screenY - p.y) * 0.05;
        p.z = rz2;

        // visual properties based on depth
        const s = Math.max(0.14, scale) * p.size * 1.0;
        const alpha = Math.max(0.045, Math.min(1, (1 - (p.z + 600) / 1200) * 1.0));

        // draw particle
        ctx.beginPath();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();

        // small bloom glow
        if (alpha > 0.08) {
          ctx.beginPath();
          ctx.globalAlpha = alpha * 0.06;
          ctx.fillStyle = `rgba(255,255,255,1)`;
          ctx.arc(p.x, p.y, s * 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(step);
    }

    // initialize
    resize();
    initParticles();
    timeRef.current = performance.now();

    // start pointer centered
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

export default function Home() {
  return (
    <div className="h-screen w-screen overflow-hidden relative" style={{ background: 'black' }}>
      {/* Background Image with subtle zoom */}
      <motion.div
        className="absolute top-0 left-0 w-full h-full z-0"
        initial={{ scale: 1 }}
        animate={{ scale: 1.06 }}
        transition={{ duration: 22, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
      >
        <Image
          src="/images/grid.jpg"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
      </motion.div>

      {/* Overlay dark translucent */}
      <div className="absolute inset-0 z-0 bg-black opacity-60"></div>

      {/* 3D Particle canvas */}
      <ParticleCanvas3D enabled={true} amount={120} />

      {/* Content */}
      <motion.div
        className="relative z-10 h-full w-full text-white flex flex-col items-start justify-center pl-10"
      >
        <Navbar />
        <header className="text-left max-w-xl">
          <motion.h1
            className="text-6xl font-bold"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            Create Flowcharts<br />In Minutes!
          </motion.h1>
          <motion.p
            className="mt-4 text-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 1 }}
          >
            Easily Visualize Processes, Workflows, And Ideas With<br />
            Our Intuitive Drag-And-Drop Editor
          </motion.p>

          {/* Animated Button */}
          <motion.button
            className="text-2xl mt-6 px-6 py-3 bg-yellow-500 text-white font-bold rounded-full cursor-pointer shadow-lg"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            whileHover={{
              scale: 1.1,
              boxShadow: "0px 0px 20px rgba(255,255,0,0.6)",
              y: -3,
              transition: { type: "spring", stiffness: 300 },
            }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started
          </motion.button>

          <motion.p
            className="ml-2 mt-2 text-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.5 }}
          >
            Get Started for Free
          </motion.p>
        </header>
      </motion.div>
    </div>
  );
}
