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

  async function createMinimalProfile(uid: string, name: string, email: string) {
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
            user.email ?? ""
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
   * Google sign-in strategy is environment-aware, based on VERIFIED
   * behaviour (REBUILD_DOCUMENTATION/AUTH_AUDIT.md), not assumption:
   *
   * - In production (Vercel), a Cross-Origin-Opener-Policy header is
   *   present that breaks signInWithPopup's window-closed detection -
   *   confirmed by curl against the deployed site. signInWithRedirect
   *   avoids this entirely and is confirmed working live.
   * - Locally (`next dev` AND a local `next build && next start`), that
   *   same header is verified ABSENT - it is injected by Vercel's
   *   platform at deploy time, not by Next.js's own build output, so
   *   popup is genuinely safe to use locally. Redirect was found to be
   *   unreliable locally specifically because signInWithRedirect
   *   depends on browser storage surviving a full-page navigation to
   *   Google and back, and modern browsers apply materially stricter
   *   storage-partitioning rules to non-secure (http://) origins - which
   *   is exactly what `localhost` is in local dev, versus the https://
   *   origin production always runs on.
   *
   * This is not a workaround stacked on the original redirect fix - it
   * is the same fix (avoid COOP breaking popups) applied only where COOP
   * is actually present, now that where that actually is has been
   * verified rather than assumed to be "everywhere".
   */
  function isLocalDevelopment(): boolean {
    if (typeof window === "undefined") return false;
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  }

  async function handleGoogleUser(user: FirebaseUser): Promise<AppUser | null> {
    const existing = await getDoc(doc(db, "users", user.uid));
    if (!existing.exists()) {
      await createMinimalProfile(user.uid, user.displayName ?? "Neighbor", user.email ?? "");
    }
    return loadProfile(user.uid);
  }

  /**
   * Returns the signed-in profile directly when popup is used (local
   * dev), so the caller can redirect immediately. In production, this
   * uses redirect - execution effectively stops as the browser navigates
   * away, and the eventual result is picked up by completeGoogleRedirect
   * on the page the user lands back on, not by this function's return
   * value.
   */
  async function loginWithGoogle(): Promise<AppUser | null> {
    const provider = new GoogleAuthProvider();
    if (isLocalDevelopment()) {
      const result = await signInWithPopup(auth, provider);
      // Explicitly sync context state here rather than waiting for
      // onAuthStateChanged's independent async listener to catch up -
      // without this, redirecting to a protected page immediately after
      // this resolves can race ahead of the listener, causing RequireAuth
      // to see firebaseUser as still null and silently bounce back to
      // /login (found via live testing, not assumed).
      setFirebaseUser(result.user);
      // Auth itself has now genuinely succeeded - Firebase has issued a
      // real session for this user. Anything that goes wrong from here
      // (Firestore profile creation/loading) is a DIFFERENT failure mode
      // than the auth step, and is tagged as such so the UI can report
      // it accurately rather than as "Google sign-in failed" (per the
      // explicit requirement to separate authentication failure from
      // profile failure, not collapse them into one message).
      setFirebaseUser(result.user);
      try {
        return await handleGoogleUser(result.user);
      } catch (profileErr) {
        const tagged = profileErr instanceof Error ? profileErr : new Error(String(profileErr));
        (tagged as Error & { stage?: string }).stage = "profile";
        throw tagged;
      }
    }
    await signInWithRedirect(auth, provider);
    return null;
  }

  /**
   * Call this once on mount of any page that offers Google sign-in. Only
   * relevant to the redirect path (production) - on the popup path
   * (local dev), loginWithGoogle's own return value already has the
   * result, so this simply resolves to null quickly there since
   * getRedirectResult has nothing to find.
   */
  async function completeGoogleRedirect(): Promise<AppUser | null> {
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
