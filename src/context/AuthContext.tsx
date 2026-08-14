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
  loginWithGoogle: () => Promise<void>;
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
   * Google sign-in uses signInWithRedirect rather than signInWithPopup.
   * Next.js sets a Cross-Origin-Opener-Policy header by default that
   * blocks the popup flow's window.closed check (a well-known Next.js +
   * Firebase Auth incompatibility), causing popup sign-in to silently
   * fail. Redirect sidesteps this - and works better on mobile anyway,
   * where popups are often blocked outright.
   */
  async function loginWithGoogle() {
    await signInWithRedirect(auth, new GoogleAuthProvider());
    // Execution stops here - the browser navigates away to Google and
    // back. See completeGoogleRedirect for what happens on return.
  }

  /**
   * Call this once on mount of any page that offers Google sign-in. If the
   * user just came back from a Google redirect, this creates their
   * profile (if new) and returns it; otherwise resolves to null quickly.
   */
  async function completeGoogleRedirect(): Promise<AppUser | null> {
    const result = await getRedirectResult(auth);
    if (!result) return null;
    const existing = await getDoc(doc(db, "users", result.user.uid));
    if (!existing.exists()) {
      await createMinimalProfile(
        result.user.uid,
        result.user.displayName ?? "Neighbor",
        result.user.email ?? ""
      );
    }
    return loadProfile(result.user.uid);
  }

  async function logout() {
    await firebaseSignOut(auth);
    setProfile(null);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
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
