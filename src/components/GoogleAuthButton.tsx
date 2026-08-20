"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getPostAuthRedirect } from "@/lib/postAuthRedirect";

export function GoogleAuthButton() {
  const { loginWithGoogle, completeGoogleRedirect } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingRedirect, setCheckingRedirect] = useState(true);

  useEffect(() => {
    // Safe to call unconditionally on every mount now: completeGoogleRedirect
    // itself checks a sessionStorage flag before ever calling
    // getRedirectResult, and that flag is only ever set by loginWithGoogle
    // when it genuinely fell back to signInWithRedirect (popup blocked,
    // network failure, or a silent hang past the 15s timeout). On the
    // normal, common path (popup just works), the flag is absent and this
    // resolves to null immediately without touching getRedirectResult at
    // all - preserving the confirmed fix for the "Database is closing/
    // hidden" race between getRedirectResult and signInWithPopup.
    completeGoogleRedirect()
      .then((profile) => {
        if (profile) router.push(getPostAuthRedirect(profile));
      })
      .catch((err) => {
        console.error("[GoogleAuthButton] completeGoogleRedirect failed:", {
          code: (err as { code?: string })?.code,
          message: err instanceof Error ? err.message : String(err),
          name: err instanceof Error ? err.name : undefined,
        });
        setError("Something went wrong signing in with Google. Please try again.");
      })
      .finally(() => setCheckingRedirect(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClick() {
    setError(null);
    setBusy(true);
    try {
      const profile = await loginWithGoogle();
      // Non-null only if popup succeeded or a redirect fallback wasn't
      // needed. If loginWithGoogle fell back to signInWithRedirect, the
      // browser navigates away before this line ever runs - profile is
      // null and nothing further happens here; completeGoogleRedirect
      // picks up the result on the page the user lands back on.
      if (profile) {
        router.push(getPostAuthRedirect(profile));
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const stage = (err as { stage?: string })?.stage;
      console.error("[GoogleAuthButton] loginWithGoogle failed:", {
        stage: stage ?? "auth",
        code,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : undefined,
        stack: err instanceof Error ? err.stack : undefined,
      });
      if (stage === "profile") {
        // Google authentication itself succeeded - this is specifically
        // a Firestore profile creation/loading failure, a genuinely
        // different problem than the sign-in step, and reported as such
        // rather than as "Google sign-in failed" (which would be
        // inaccurate - sign-in didn't fail).
        setError("You're signed in with Google, but we couldn't set up your account profile. Please try again, or contact an administrator if this keeps happening.");
      } else if (code === "auth/popup-blocked") {
        setError("Your browser blocked the sign-in popup. Please allow popups for this site and try again.");
      } else if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // User deliberately closed it - not an error worth showing.
      } else if (code === "auth/account-exists-with-different-credential") {
        setError("An account already exists with this email using a different sign-in method.");
      } else if (code === "auth/network-request-failed") {
        setError("A network error interrupted sign-in. Please check your connection and try again.");
      } else if (code === "auth/unauthorized-domain") {
        setError("This site isn't authorised for Google sign-in yet. Please contact an administrator.");
      } else {
        setError(`Something went wrong starting Google sign-in${code ? ` (${code})` : ""}. Please try again.`);
      }
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || checkingRedirect}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
          />
        </svg>
        {busy ? "Redirecting to Google..." : "Continue with Google"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
