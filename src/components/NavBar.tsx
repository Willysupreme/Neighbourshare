"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { NotificationsBell } from "@/components/NotificationsBell";

export function NavBar() {
  const { firebaseUser, profile, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.push("/");
  }

  const linkClass = "text-ink/70 transition-colors hover:text-ink";
  const mobileLinkClass = "block w-full py-3 text-left text-ink/80 hover:text-ink";

  return (
    // Sticky, not fixed: keeps the nav in normal document flow (no
    // separate top-padding compensation needed elsewhere), while still
    // staying visible at the top of the viewport as the page scrolls.
    // z-50 keeps it above dropdowns like NotificationsBell's own panel
    // but below nothing else in this app - no other component uses a
    // higher z-index, verified by grep across src/components.
    <header className="sticky top-0 z-50 border-b border-line bg-paper-raised">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 display-heading text-xl text-ink">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="3" fill="var(--ink)" />
            {[...Array(8)].map((_, i) => {
              const angle = (i * 45 * Math.PI) / 180;
              return (
                <line
                  key={i}
                  x1={10}
                  y1={10}
                  x2={10 + 9 * Math.cos(angle)}
                  y2={10 + 9 * Math.sin(angle)}
                  stroke="var(--ink)"
                  strokeWidth="1.2"
                />
              );
            })}
          </svg>
          Neighbor<span className="text-gold">Share</span>
        </Link>

        {/* Desktop nav - hidden below md, matching the mobile-menu breakpoint below */}
        <nav className="hidden items-center gap-5 font-tag text-xs uppercase tracking-wide md:flex">
          <Link href="/items" className={linkClass}>
            Browse
          </Link>
          {firebaseUser ? (
            <>
              <Link href="/dashboard" className={linkClass}>
                Dashboard
              </Link>
              <Link href="/items/new" className={linkClass}>
                List an item
              </Link>
              {profile?.role === "admin" && (
                <Link href="/admin" className={linkClass}>
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
              <Link href="/login" className={linkClass}>
                Log in
              </Link>
              <Link href="/register" className="btn-primary normal-case">
                Sign up
              </Link>
            </>
          )}
        </nav>

        {/* Mobile: notification bell (kept visible even when menu is closed) + hamburger toggle */}
        <div className="flex items-center gap-3 md:hidden">
          {firebaseUser && <NotificationsBell />}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              {menuOpen ? (
                <path d="M2 2 L16 16 M16 2 L2 16" stroke="currentColor" strokeWidth="1.8" />
              ) : (
                <path d="M1 4 H17 M1 9 H17 M1 14 H17" stroke="currentColor" strokeWidth="1.8" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <nav
          id="mobile-nav-menu"
          className="border-t border-line bg-paper-raised px-4 pb-3 font-tag text-xs uppercase tracking-wide md:hidden"
        >
          <Link href="/items" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
            Browse
          </Link>
          {firebaseUser ? (
            <>
              <Link href="/dashboard" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              <Link href="/items/new" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                List an item
              </Link>
              {profile?.role === "admin" && (
                <Link href="/admin" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                  Admin
                </Link>
              )}
              <button onClick={handleLogout} className="mt-2 w-full btn-secondary normal-case">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                Log in
              </Link>
              <Link
                href="/register"
                className="mt-2 block w-full btn-primary text-center normal-case"
                onClick={() => setMenuOpen(false)}
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
