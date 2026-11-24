// hooks/use-auth.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_EVENT, getTokens, getViewer, type User } from "@/lib/auth";

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const latest = useRef<number>(0);

  const loadSession = useCallback(async (): Promise<void> => {
    const id: number = ++latest.current;
    const isCurrent = (): boolean => id === latest.current;

    if (!getTokens()) {
      setUser(null);
      setError(false);
      setLoading(false);
      return;
    }

    try {
      const viewer: User = await getViewer();
      if (!isCurrent()) return;
      setUser(viewer);
      setError(false);
    } catch {
      if (!isCurrent()) return;
      if (getTokens()) {
        setError(true); // tokens still stored: network or server problem, not a sign-out
      } else {
        setUser(null); // authedRequest already logged out an expired session
        setError(false);
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Reads localStorage after mount, so a synchronous state update here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSession();
    const onChange = (): void => {
      void loadSession();
    };
    window.addEventListener(AUTH_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      latest.current++; // ignore responses that arrive after unmount
      window.removeEventListener(AUTH_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [loadSession]);

  const retry = useCallback((): void => {
    setError(false);
    setLoading(true);
    void loadSession();
  }, [loadSession]);

  return { user, loading, error, retry, refresh: loadSession };
}
