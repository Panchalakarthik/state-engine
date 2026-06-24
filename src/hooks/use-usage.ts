"use client";

import { useState, useEffect, useCallback } from "react";

interface UsageState {
  count: number;
  limit: number;
  limitReached: boolean;
  loading: boolean;
}

export function useUsage() {
  const [usage, setUsage] = useState<UsageState>({
    count: 0,
    limit: 3,
    limitReached: false,
    loading: true,
  });

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => setUsage({ ...data, loading: false }))
      .catch(() => setUsage((u) => ({ ...u, loading: false })));
  }, []);

  const incrementUsage = useCallback(async (): Promise<boolean> => {
    const res = await fetch("/api/usage", { method: "POST" });
    const data = await res.json();
    setUsage({ ...data, loading: false });
    return !data.limitReached;
  }, []);

  return { usage, incrementUsage };
}
