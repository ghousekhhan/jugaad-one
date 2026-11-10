"use client";

import { getDefaultPreferences, getPreferences, subscribePreferences } from "@/lib/sound/engine";
import { useEffect, useRef, useSyncExternalStore } from "react";

export function PaymentCelebration() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useSyncExternalStore(subscribePreferences, getPreferences, getDefaultPreferences).motion === "reduce";

  useEffect(() => {
    const element = canvas.current;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const context = element?.getContext("2d");
    if (!element || !context || reduced || reducedMotion.matches) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = Math.min(window.devicePixelRatio, 2);
    element.width = width * scale;
    element.height = height * scale;
    context.scale(scale, scale);
    const origin = document.querySelector(".pay-confirmation-mark")?.getBoundingClientRect();
    const centerX = origin ? origin.x + origin.width / 2 : width / 2;
    const centerY = origin ? origin.y + origin.height / 2 : height * .35;
    const colors = ["#f26a35", "#e5ab37", "#fff9e9", "#83a995", "#ee9f78", "#264e3d"];
    const count = width >= 800 && navigator.hardwareConcurrency >= 4 ? 280 : 110;
    const particles = Array.from({ length: count }, (_, index) => ({
      color: colors[index % colors.length],
      delay: index < count * .75 ? 650 : 940,
      x: centerX + (index % 3 - 1) * 56,
      y: centerY,
      vx: (Math.random() - .5) * Math.min(width, 780),
      vy: -(110 + Math.random() * 380),
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - .5) * 12,
      size: 3 + Math.random() * 7,
      round: index % 4 === 0,
    }));
    const start = performance.now();
    let frame = 0;
    function draw(now: number) {
      if (!context || reducedMotion.matches) return;
      context.clearRect(0, 0, width, height);
      for (const p of particles) {
        const age = (now - start - p.delay) / 1000;
        if (age < 0 || age >= 2.4) continue;
        context.save();
        context.globalAlpha = Math.min(1, (2.4 - age) * 1.6);
        context.translate(p.x + p.vx * age, p.y + p.vy * age + 225 * age * age);
        context.rotate(p.rotation + p.spin * age);
        context.scale(1, .35 + .65 * Math.abs(Math.cos(p.spin * age)));
        context.fillStyle = p.color;
        if (p.round) {
          context.beginPath();
          context.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          context.fill();
        } else context.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        context.restore();
      }
      if (now - start < 3350) frame = requestAnimationFrame(draw);
      else context.clearRect(0, 0, width, height);
    }
    function stop() {
      cancelAnimationFrame(frame);
      context?.clearRect(0, 0, width, height);
    }
    frame = requestAnimationFrame(draw);
    reducedMotion.addEventListener("change", stop);
    return () => {
      stop();
      reducedMotion.removeEventListener("change", stop);
    };
  }, [reduced]);

  return <canvas className="pay-confetti" aria-hidden="true" ref={canvas} />;
}
