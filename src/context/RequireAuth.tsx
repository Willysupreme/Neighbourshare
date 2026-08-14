"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function RequireAuth({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { firebaseUser, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (requireAdmin && profile && profile.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [loading, firebaseUser, profile, requireAdmin, router]);

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

  return <>{children}</>;
}
