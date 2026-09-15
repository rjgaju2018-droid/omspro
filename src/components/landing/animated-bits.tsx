"use client";

// 2026-09-15 — react-bits-style animated components ("install The largest &
// most creative library of animated React components" — react-bits is a
// copy-paste component collection, not an npm runtime, so the app ships the
// handful of bits it needs right here, dependency-free, in the same
// spirit: small, customizable, CSS/intersection-driven). All honor
// prefers-reduced-motion.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Per-word staggered rise-in for headlines (react-bits "SplitText"). */
export function SplitText({
  text,
  className,
  delay = 0,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: "span" | "h1" | "h2" | "p";
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const words = text.split(" ");
  return (
    <Tag ref={ref as never} className={className} aria-label={text} style={{ perspective: 600 }}>
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          aria-hidden="true"
          className="inline-block will-change-transform"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? "none" : "translateY(0.6em) rotateX(-40deg)",
            transition: `opacity 0.5s ease ${delay + i * 45}ms, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${delay + i * 45}ms`,
          }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

/** Fade+rise reveal for any block (react-bits "FadeContent"/"ScrollReveal"). */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  style,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${y}px)`,
        transition: `opacity 0.7s ease ${delay}ms, transform 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** Counts up to a number when scrolled into view (react-bits "CountUp"). */
export function CountUp({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setValue(to);
          return;
        }
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

/** Infinite CSS marquee (react-bits "LogoLoop") for the products ribbon.
 *  The keyframes live in globals.css (`oms-marquee`) — no styled-jsx. */
export function Marquee({ children, speed = 30, reverse = false }: { children: ReactNode; speed?: number; reverse?: boolean }) {
  return (
    <div className="group relative overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div
        className="flex w-max gap-4 group-hover:[animation-play-state:paused]"
        style={{ animation: `oms-marquee ${speed}s linear infinite ${reverse ? "reverse" : "normal"}` }}
      >
        {children}
        {children}
      </div>
    </div>
  );
}
