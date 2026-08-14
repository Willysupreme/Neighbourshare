"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { NotificationsBell } from "@/components/NotificationsBell";

export function NavBar() {
  const { firebaseUser, profile, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <header className="border-b border-line bg-paper-raised">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="display-heading text-xl text-ink">
          Neighbor<span className="text-rust">Share</span>
        </Link>

        <nav className="flex items-center gap-5 font-tag text-xs uppercase tracking-wide">
          <Link href="/items" className="text-ink/70 transition-colors hover:text-ink">
            Browse
          </Link>

          {firebaseUser ? (
            <>
              <Link href="/dashboard" className="text-ink/70 transition-colors hover:text-ink">
                Dashboard
              </Link>
              <Link href="/items/new" className="text-ink/70 transition-colors hover:text-ink">
                List an item
              </Link>
              {profile?.role === "admin" && (
                <Link href="/admin" className="text-ink/70 transition-colors hover:text-ink">
                  Admin
                </Link>
              )}
              <NotificationsBell />
              <button onClick={handleLogout} className="btn-secondary normal-case">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-ink/70 transition-colors hover:text-ink">
                Log in
              </Link>
              <Link href="/register" className="btn-primary normal-case">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
