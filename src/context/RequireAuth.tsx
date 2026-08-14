"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const EXEMPT_FROM_NEIGHBORHOOD_CHECK = ["/choose-neighborhood"];

export function RequireAuth({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { firebaseUser, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (requireAdmin && profile && profile.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    if (
      profile &&
      !profile.neighborhoodId &&
      !EXEMPT_FROM_NEIGHBORHOOD_CHECK.includes(pathname)
    ) {
      router.replace("/choose-neighborhood");
    }
  }, [loading, firebaseUser, profile, requireAdmin, pathname, router]);

  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-500">
        Loading...
      </div>
    );
  }

  if (requireAdmin && profile && profile.role !== "admin") {
    return null;
  }

  if (profile && !profile.neighborhoodId && !EXEMPT_FROM_NEIGHBORHOOD_CHECK.includes(pathname)) {
    return null;
  }

  return <>{children}</>;
}
