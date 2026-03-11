"use client";

import { useState, useEffect } from "react";

interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  drift: number;
}

const FIRE_COLORS = [
  "var(--pending-amber)",
  "var(--brand-crimson)",
  "#ff6b35",
  "#ff9500",
];

/**
 * Deterministic pseudo-random number using a Linear Congruential Generator (LCG).
 * Constants (1664525, 1013904223) are the standard Numerical Recipes parameters
 * chosen for good statistical properties on 32-bit integers. The `& 0x7fffffff`
 * mask keeps the result positive. Using a seeded approach instead of Math.random()
 * ensures the same particle positions are generated on every render, avoiding a
 * React hydration mismatch between server and client.
 */
function seeded(i: number, mod: number): number {
  return ((i * 1664525 + 1013904223) & 0x7fffffff) % mod;
}

/**
 * Fire-like particles that animate from the very bottom of the viewport upward
 * to the midpoint. Rendered on client only to avoid hydration mismatches.
 */
export default function FireParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const generated: Particle[] = Array.from({ length: 28 }, (_, i) => ({
      id: i,
      // spread across full width, avoiding edges
      left: 3 + seeded(i + 1, 94),
      delay: (seeded(i + 7, 40)) / 10,          // 0 – 4s
      duration: 2.5 + (seeded(i + 13, 25)) / 10, // 2.5 – 5s
      size: 5 + seeded(i + 3, 14),               // 5 – 18px
      color: FIRE_COLORS[seeded(i + 5, FIRE_COLORS.length)],
      drift: (seeded(i + 9, 60)) - 30,           // -30 – +30px horizontal drift
    }));
    setParticles(generated);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "50vh",
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            bottom: "-10%",
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.4,
            borderRadius: "50% 50% 40% 40%",
            background: p.color,
            opacity: 0,
            filter: `blur(${p.size * 0.45}px)`,
            animationName: "fire-rise",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: "ease-out",
            animationIterationCount: "infinite",
            animationFillMode: "both",
            // `--drift` is read by the `fire-rise` @keyframes animation defined in
            // globals.css as translateX(var(--drift)) to add a horizontal wobble.
            "--drift": `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
