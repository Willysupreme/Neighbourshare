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
  signInWithPopup,
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadProfile(user.uid);
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
   * Google sign-in doubles as both login and registration - Firebase Auth
   * itself doesn't distinguish new vs returning users the way email/password
   * signup does. We detect "new" by checking whether a Firestore profile
   * already exists, and create a minimal one (no neighborhood chosen yet)
   * if not. The calling page decides where to route next based on the
   * resulting profile state (see getPostAuthRedirect).
   */
  async function loginWithGoogle() {
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    const existing = await getDoc(doc(db, "users", credential.user.uid));
    if (!existing.exists()) {
      await createMinimalProfile(
        credential.user.uid,
        credential.user.displayName ?? "Neighbor",
        credential.user.email ?? ""
      );
    }
    return loadProfile(credential.user.uid);
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
      value={{ firebaseUser, profile, loading, register, login, loginWithGoogle, logout, resetPassword, refreshProfile }}
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
