"use client";

import { useEffect, useRef, useState } from "react";

// Adds a flag once the element scrolls into view; the animation itself is
// plain CSS (design.md §4 — "one small IntersectionObserver hook that adds a
// class"). Fires once, so a panel doesn't re-stamp every time it crosses the
// viewport edge while scrolling back up.
export default function useInView({ threshold = 0.3 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No motion: show the final state right away instead of waiting on scroll.
      const t = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(t);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}
