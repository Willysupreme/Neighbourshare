"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function NavBar() {
  const { firebaseUser, profile, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-emerald-700">
          NeighborShare
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/items" className="text-neutral-600 hover:text-neutral-900">
            Browse
          </Link>

          {firebaseUser ? (
            <>
              <Link href="/dashboard" className="text-neutral-600 hover:text-neutral-900">
                Dashboard
              </Link>
              <Link href="/items/new" className="text-neutral-600 hover:text-neutral-900">
                List an item
              </Link>
              {profile?.role === "admin" && (
                <Link href="/admin" className="text-neutral-600 hover:text-neutral-900">
                  Admin
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="rounded-md bg-neutral-100 px-3 py-1.5 text-neutral-700 hover:bg-neutral-200"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-neutral-600 hover:text-neutral-900">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
