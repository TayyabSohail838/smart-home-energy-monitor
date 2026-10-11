"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// Fetches one of our API routes from the browser (the login cookie goes along).
// 401 -> login page, 404 "no device linked" -> link page.
// refreshMs re-fetches in the background, keeping the old data on screen.
export function useApi(path, { refreshMs } = {}) {
  const router = useRouter();
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!path) return;
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (res.status === 401) return router.replace("/login");
      const body = await res.json().catch(() => ({}));
      if (res.status === 404 && body.error === "no device linked") return router.replace("/link");
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      if (alive.current) setState({ data: body, error: null, loading: false });
    } catch (err) {
      if (alive.current) setState((s) => ({ ...s, error: err.message, loading: false }));
    }
  }, [path, router]);

  useEffect(() => {
    alive.current = true;
    load();
    const timer = refreshMs ? setInterval(load, refreshMs) : null;
    return () => {
      alive.current = false;
      if (timer) clearInterval(timer);
    };
  }, [load, refreshMs]);

  return { ...state, reload: load };
}
