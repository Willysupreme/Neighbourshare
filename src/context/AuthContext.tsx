"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { AppUser } from "@/types";
import { RegisterInput } from "@/lib/validation/schemas";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: AppUser | null;
  loading: boolean;
  register: (input: RegisterInput) => Promise<AppUser | null>;
  login: (email: string, password: string) => Promise<AppUser | null>;
  loginWithGoogle: () => Promise<AppUser | null>;
  completeGoogleRedirect: () => Promise<AppUser | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

class PopupTimeoutError extends Error {
  constructor() {
    super("Google sign-in popup did not complete within the expected time.");
    this.name = "PopupTimeoutError";
  }
}

let googleSignInInFlight = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string): Promise<AppUser | null> {
    const snap = await getDoc(doc(db, "users", uid));
    const loaded = snap.exists() ? (snap.data() as AppUser) : null;
    setProfile(loaded);
    return loaded;
  }

  async function createMinimalProfile(uid: string, name: string, email: string, photoUrl?: string | null) {
    const newUser: Omit<AppUser, "createdAt" | "updatedAt"> & {
      createdAt: unknown;
      updatedAt: unknown;
    } = {
      uid,
      name,
      email,
      neighborhoodId: "",
      role: "user",
      accountStatus: "active",
      verificationStatus: "unverified",
      trustScore: 3.0,
      completedTransactions: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    // Only set when Google actually provided one - avoids writing an
    // empty/undefined photoUrl for email/password signups, which have no
    // photo at all.
    if (photoUrl) {
      newUser.photoUrl = photoUrl;
    }
    await setDoc(doc(db, "users", uid), newUser);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const loaded = await loadProfile(user.uid);
        if (!loaded) {
          // Auth account exists but no Firestore profile - most likely an
          // interrupted signup (e.g. a Google redirect that authenticated
          // successfully but didn't finish writing the profile doc, or a
          // network blip mid-registration). Self-heal rather than leaving
          // the person stuck signed-in with nothing to show for it.
          await createMinimalProfile(
            user.uid,
            user.displayName ?? "Neighbor",
            user.email ?? "",
            user.photoURL
          );
          await loadProfile(user.uid);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function register(input: RegisterInput) {
    const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
    await updateProfile(credential.user, { displayName: input.name });
    await createMinimalProfile(credential.user.uid, input.name, input.email);
    return loadProfile(credential.user.uid);
  }

  async function login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return loadProfile(credential.user.uid);
  }

  /**
   * Google sign-in now tries signInWithPopup everywhere (previously
   * environment-aware: popup locally, redirect in production, because
   * Vercel's platform-level COOP header broke popup's window.closed
   * detection there). An explicit app-level COOP header
   * (same-origin-allow-popups, see next.config.ts) has since been added,
   * which should address that - but this cannot be verified from a
   * sandbox against Vercel's actual live behaviour, so popup is not
   * trusted unconditionally in production: it falls back to
   * signInWithRedirect (the previously-confirmed-working production
   * path) if popup fails.
   *
   * Two distinct failure modes are handled, not just one:
   * 1. signInWithPopup rejects with a clear error (auth/popup-blocked,
   *    auth/network-request-failed) - caught normally.
   * 2. A COOP-broken popup does NOT always throw - it can leave
   *    signInWithPopup's promise simply never resolving, because the
   *    underlying window.closed check it depends on never fires. A plain
   *    try/catch cannot detect this. Raced against a generous timeout
   *    (15s) specifically to catch this silent-hang case, not used as a
   *    general-purpose "assume it's done" synchronisation hack.
   *
   * auth/popup-closed-by-user and auth/cancelled-popup-request are
   * deliberate user actions, not technical failures - these do NOT fall
   * back to redirect (that would unexpectedly full-page-navigate someone
   * who just closed a popup on purpose).
   */
  const GOOGLE_REDIRECT_PENDING_KEY = "neighborshare_google_redirect_pending";

  async function handleGoogleUser(user: FirebaseUser): Promise<AppUser | null> {
    const existing = await getDoc(doc(db, "users", user.uid));
    if (!existing.exists()) {
      await createMinimalProfile(user.uid, user.displayName ?? "Neighbor", user.email ?? "", user.photoURL);
    }
    return loadProfile(user.uid);
  }

  async function loginWithGoogle(): Promise<AppUser | null> {
    // Reentrancy guard, independent of GoogleAuthButton's own disabled-
    // while-busy UI state - protects any caller of this function, not
    // just clicks on one specific button, from triggering a second
    // concurrent signInWithPopup while one is already in flight. This
    // matters specifically here: two concurrent Firebase Auth operations
    // contending for the same IndexedDB persistence layer is exactly the
    // class of problem this whole investigation has been about.
    if (googleSignInInFlight) {
      throw Object.assign(new Error("A Google sign-in attempt is already in progress."), {
        code: "auth/cancelled-popup-request",
      });
    }
    googleSignInInFlight = true;

    const provider = new GoogleAuthProvider();

    try {
      const result = await Promise.race([
        signInWithPopup(auth, provider),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new PopupTimeoutError()), 15000)
        ),
      ]);
      // Explicitly sync context state here rather than waiting for
      // onAuthStateChanged's independent async listener to catch up -
      // without this, redirecting to a protected page immediately after
      // this resolves can race ahead of the listener, causing RequireAuth
      // to see firebaseUser as still null and silently bounce back to
      // /login (found via live testing, not assumed).
      setFirebaseUser(result.user);
      try {
        return await handleGoogleUser(result.user);
      } catch (profileErr) {
        // Auth itself genuinely succeeded here - Firebase issued a real
        // session. A failure past this point (Firestore profile creation/
        // loading) is a DIFFERENT failure mode than sign-in itself, and
        // is tagged as such so the UI reports it accurately rather than
        // as "Google sign-in failed" (sign-in didn't fail).
        const tagged = profileErr instanceof Error ? profileErr : new Error(String(profileErr));
        (tagged as Error & { stage?: string }).stage = "profile";
        throw tagged;
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const isTimeout = err instanceof PopupTimeoutError;
      const shouldFallBackToRedirect =
        isTimeout || code === "auth/popup-blocked" || code === "auth/network-request-failed";

      if (!shouldFallBackToRedirect) {
        throw err;
      }

      // Signal to completeGoogleRedirect (checked on the next page load,
      // after Google redirects back) that a redirect was genuinely
      // initiated here - without this flag, an unconditional
      // getRedirectResult() call on every mount would race with
      // signInWithPopup's own IndexedDB usage on the normal, common
      // popup path, reintroducing the exact "Database is closing/hidden"
      // bug this flag-based approach is specifically designed to avoid.
      sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, "1");
      await signInWithRedirect(auth, provider);
      return null;
    } finally {
      googleSignInInFlight = false;
    }
  }

  /**
   * Call this once on mount of any page that offers Google sign-in.
   * Checks GOOGLE_REDIRECT_PENDING_KEY BEFORE calling getRedirectResult
   * at all - on the normal, common path (popup succeeded, no fallback
   * was ever triggered), this flag is absent and getRedirectResult is
   * skipped entirely. This is what preserves the confirmed fix for the
   * "Database is closing/hidden" bug: an unconditional getRedirectResult
   * call on every mount was found (via live testing) to race with
   * signInWithPopup's own IndexedDB usage. Only when the flag is present
   * - meaning loginWithGoogle genuinely fell back to signInWithRedirect
   * moments before this page loaded - is getRedirectResult called, which
   * is safe at that point since no popup is concurrently active.
   */
  async function completeGoogleRedirect(): Promise<AppUser | null> {
    if (typeof window === "undefined" || !sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY)) {
      return null;
    }
    sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
    const result = await getRedirectResult(auth);
    if (!result) return null;
    return handleGoogleUser(result.user);
  }

  async function logout() {
    await firebaseSignOut(auth);
    setProfile(null);
  }

  async function resetPassword(email: string) {
    // ActionCodeSettings.url is captured from window.location.origin at
    // call time, not hardcoded - this is genuinely correct in both
    // environments without an environment-specific branch, since it
    // simply reflects wherever the request actually came from.
    await sendPasswordResetEmail(auth, email, {
      url: `${window.location.origin}/login`,
    });
  }

  async function refreshProfile() {
    if (firebaseUser) await loadProfile(firebaseUser.uid);
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        register,
        login,
        loginWithGoogle,
        completeGoogleRedirect,
        logout,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
