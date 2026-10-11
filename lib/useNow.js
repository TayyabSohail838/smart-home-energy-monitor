"use client";

import { useEffect, useState } from "react";

// Current time in ms, refreshed every `intervalMs`. Null until mounted, so
// server and first client render match and render stays pure.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
