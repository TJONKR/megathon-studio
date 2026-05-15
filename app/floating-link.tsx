"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = [
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#5ac8fa",
  "#007aff",
  "#af52de",
  "#ff2d92",
];

export function FloatingLink() {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const posRef = useRef({ x: 80, y: 120, vx: 1.4, vy: 1.1 });
  const rafRef = useRef<number | null>(null);
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;

    posRef.current.x = Math.random() * Math.max(0, window.innerWidth - 200);
    posRef.current.y = Math.random() * Math.max(0, window.innerHeight - 80);

    const tick = () => {
      const node = ref.current;
      if (!node) return;
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      const maxX = window.innerWidth - w;
      const maxY = window.innerHeight - h;
      const p = posRef.current;
      p.x += p.vx;
      p.y += p.vy;
      let bounced = false;
      if (p.x <= 0) {
        p.x = 0;
        p.vx = Math.abs(p.vx);
        bounced = true;
      } else if (p.x >= maxX) {
        p.x = maxX;
        p.vx = -Math.abs(p.vx);
        bounced = true;
      }
      if (p.y <= 0) {
        p.y = 0;
        p.vy = Math.abs(p.vy);
        bounced = true;
      } else if (p.y >= maxY) {
        p.y = maxY;
        p.vy = -Math.abs(p.vy);
        bounced = true;
      }
      if (bounced) {
        setColor((c) => {
          const remaining = COLORS.filter((x) => x !== c);
          return remaining[Math.floor(Math.random() * remaining.length)];
        });
      }
      node.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <a
      ref={ref}
      href="https://megathon.xyz/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Visit megathon.xyz"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        padding: "14px 22px",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#fff",
        background: color,
        border: "3px solid #000",
        borderRadius: 0,
        boxShadow: "5px 5px 0 #000",
        textDecoration: "none",
        userSelect: "none",
        willChange: "transform",
        transition: "background-color 200ms ease",
        pointerEvents: "auto",
      }}
    >
      megathon.xyz ↗
    </a>
  );
}
