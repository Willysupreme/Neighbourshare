"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types";

const EXEMPT_FROM_NEIGHBORHOOD_CHECK = ["/choose-neighborhood"];

function isRoleAllowed(role: UserRole | undefined, requireAdmin: boolean, allowRoles?: UserRole[]) {
  if (requireAdmin) return role === "admin";
  if (allowRoles) return !!role && allowRoles.includes(role);
  return true;
}

export function RequireAuth({
  children,
  requireAdmin = false,
  allowRoles,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  // Rebuild Phase 10: more general than requireAdmin - lets a page allow
  // e.g. ["admin", "representative"] without opening it to plain users,
  // for pages like verification review that a representative should
  // reach but the full /admin dashboard should not be opened to.
  allowRoles?: UserRole[];
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
    if (profile && !isRoleAllowed(profile.role, requireAdmin, allowRoles)) {
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
  }, [loading, firebaseUser, profile, requireAdmin, allowRoles, pathname, router]);

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

  if (profile && !isRoleAllowed(profile.role, requireAdmin, allowRoles)) {
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
