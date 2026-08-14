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
  const { firebaseUser, profile, loading, logout } = useAuth();
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
      profile.accountStatus === "active" &&
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

  if (profile && profile.accountStatus === "suspended") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="display-heading text-2xl text-clay">Account suspended</p>
        <p className="mt-3 text-sm text-neutral-600">
          Your account has been suspended by an administrator. You can&apos;t list items,
          request bookings, or take other actions while suspended. If you believe this is a
          mistake, contact an administrator.
        </p>
        <button onClick={() => logout()} className="btn-secondary mt-6">
          Log out
        </button>
      </div>
    );
  }

  if (requireAdmin && profile && profile.role !== "admin") {
    return null;
  }

  if (
    profile &&
    profile.accountStatus === "active" &&
    !profile.neighborhoodId &&
    !EXEMPT_FROM_NEIGHBORHOOD_CHECK.includes(pathname)
  ) {
    return null;
  }

  return <>{children}</>;
}
