// components/auth-guard.tsx
"use client";
// ------------------------------------------------------------------
// Wraps protected pages. While the session is checked a skeleton is
// shown. If the user is not signed in they are redirected to
// /my-account with a return path.
// ------------------------------------------------------------------

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import AccountSkeleton from "./account-skeleton";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const returnUrl = encodeURIComponent(window.location.pathname);
      router.replace(`/my-account?return=${returnUrl}`);
    }
  }, [loading, user, router]);

  if (loading) return <AccountSkeleton />;
  if (!user) return null; // Will redirect — show nothing while navigating

  return <>{children}</>;
}
