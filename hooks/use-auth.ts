// hooks/use-auth.ts
"use client";
// ------------------------------------------------------------------
// React hook that tracks the current user and loading state.
// Re-runs on the custom AUTH_EVENT so the header updates instantly.
// ------------------------------------------------------------------

import { useState, useEffect, useCallback } from "react";
import { getViewer, getTokens, AUTH_EVENT, User } from "@/lib/auth";

interface AuthState {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const tokens = getTokens();
    if (!tokens) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const viewer = await getViewer();
      setUser(viewer);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Hydrate auth state from localStorage after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch();

    const handler = () => fetch();
    window.addEventListener(AUTH_EVENT, handler);
    return () => window.removeEventListener(AUTH_EVENT, handler);
  }, [fetch]);

  return { user, loading, refresh: fetch };
}
