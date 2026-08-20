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
  linkWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  updateProfile,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  getMultiFactorResolver,
  MultiFactorError,
  MultiFactorResolver,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
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
  linkGoogleAccount: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshEmailVerified: () => Promise<boolean>;
  beginTotpEnrollment: () => Promise<TotpSecret>;
  confirmTotpEnrollment: (secret: TotpSecret, verificationCode: string, displayName: string) => Promise<void>;
  unenrollMfaFactor: (factorUid: string) => Promise<void>;
  getMfaResolver: (error: MultiFactorError) => MultiFactorResolver;
  completeTotpSignIn: (resolver: MultiFactorResolver, verificationCode: string) => Promise<AppUser | null>;
  beginPhoneMfaEnrollment: (phoneNumber: string, recaptchaContainerId: string) => Promise<string>;
  confirmPhoneMfaEnrollment: (verificationId: string, verificationCode: string, displayName: string) => Promise<void>;
  beginPhoneMfaChallenge: (resolver: MultiFactorResolver, recaptchaContainerId: string) => Promise<string>;
  completePhoneMfaSignIn: (
    resolver: MultiFactorResolver,
    verificationId: string,
    verificationCode: string
  ) => Promise<AppUser | null>;
  refreshProfile: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateUserPhoto: (photoUrl: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
    // Best-effort - a failure here shouldn't block registration itself,
    // since the person can always request another verification email
    // later from Settings.
    try {
      await sendEmailVerification(credential.user, {
        url: `${window.location.origin}/dashboard`,
      });
    } catch (err) {
      console.error("[AuthContext] sendEmailVerification on registration failed:", err);
    }
    return loadProfile(credential.user.uid);
  }

  async function resendVerificationEmail(): Promise<void> {
    if (!auth.currentUser) {
      throw new Error("You must be signed in to request a verification email.");
    }
    await sendEmailVerification(auth.currentUser, {
      url: `${window.location.origin}/dashboard`,
    });
  }

  /**
   * Firebase's emailVerified flag on the User object is a snapshot from
   * when it was last fetched - it does NOT live-update just because the
   * person clicked the link in their email in another tab. Call this
   * (e.g. after the person says "I've verified it") to force a reload
   * from Firebase and pick up the current status.
   */
  async function refreshEmailVerified(): Promise<boolean> {
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    setFirebaseUser(auth.currentUser);
    return auth.currentUser.emailVerified;
  }

  async function login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return loadProfile(credential.user.uid);
  }

  /**
   * TOTP MFA enrollment - two steps, since the person needs to actually
   * scan/enter the secret in their authenticator app before Firebase
   * will confirm enrollment. beginTotpEnrollment generates the secret;
   * the caller renders it as a QR code (or shows the raw secret as a
   * manual-entry fallback) and later calls confirmTotpEnrollment with
   * the 6-digit code the app then generates.
   */
  async function beginTotpEnrollment() {
    if (!auth.currentUser) {
      throw new Error("You must be signed in to set up an authenticator app.");
    }
    const session = await multiFactor(auth.currentUser).getSession();
    return TotpMultiFactorGenerator.generateSecret(session);
  }

  async function confirmTotpEnrollment(
    secret: TotpSecret,
    verificationCode: string,
    displayName: string
  ) {
    if (!auth.currentUser) {
      throw new Error("You must be signed in to set up an authenticator app.");
    }
    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, verificationCode);
    await multiFactor(auth.currentUser).enroll(assertion, displayName);
  }

  async function unenrollMfaFactor(factorUid: string) {
    if (!auth.currentUser) {
      throw new Error("You must be signed in to manage your authenticator app.");
    }
    await multiFactor(auth.currentUser).unenroll(factorUid);
  }

  /**
   * Called from the login page's catch block when signInWithEmailAndPassword
   * throws auth/multi-factor-auth-required - the password was correct,
   * but a second factor is enrolled and required. Not specific to any
   * one factor type - the resolver's hints list is checked by the
   * caller to determine which challenge UI (TOTP code entry, or phone
   * SMS) to show.
   */
  function getMfaResolver(error: MultiFactorError): MultiFactorResolver {
    return getMultiFactorResolver(auth, error);
  }

  async function completeTotpSignIn(
    resolver: MultiFactorResolver,
    verificationCode: string
  ): Promise<AppUser | null> {
    const enrolledFactor = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
    if (!enrolledFactor) {
      throw new Error("No authenticator app factor found for this account.");
    }
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(enrolledFactor.uid, verificationCode);
    const credential = await resolver.resolveSignIn(assertion);
    return loadProfile(credential.user.uid);
  }

  /**
   * Phone MFA, an alternative to TOTP. Firebase requires a reCAPTCHA
   * verifier for any phone-based flow (enrollment AND the sign-in
   * challenge) - the caller must have a real DOM element with the given
   * id already mounted (invisible is fine) before calling either of
   * these. A fresh RecaptchaVerifier is created per call and cleared
   * immediately after use, since each is a one-shot verification, not a
   * persistent widget.
   */
  async function beginPhoneMfaEnrollment(phoneNumber: string, recaptchaContainerId: string): Promise<string> {
    if (!auth.currentUser) {
      throw new Error("You must be signed in to set up phone verification.");
    }
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
    try {
      const session = await multiFactor(auth.currentUser).getSession();
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      return await phoneAuthProvider.verifyPhoneNumber({ phoneNumber, session }, verifier);
    } finally {
      verifier.clear();
    }
  }

  async function confirmPhoneMfaEnrollment(
    verificationId: string,
    verificationCode: string,
    displayName: string
  ) {
    if (!auth.currentUser) {
      throw new Error("You must be signed in to set up phone verification.");
    }
    const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
    const assertion = PhoneMultiFactorGenerator.assertion(credential);
    await multiFactor(auth.currentUser).enroll(assertion, displayName);
  }

  async function beginPhoneMfaChallenge(
    resolver: MultiFactorResolver,
    recaptchaContainerId: string
  ): Promise<string> {
    const hint = resolver.hints.find((h) => h.factorId === PhoneMultiFactorGenerator.FACTOR_ID);
    if (!hint) {
      throw new Error("No phone factor found for this account.");
    }
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
    try {
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      return await phoneAuthProvider.verifyPhoneNumber({ multiFactorHint: hint, session: resolver.session }, verifier);
    } finally {
      verifier.clear();
    }
  }

  async function completePhoneMfaSignIn(
    resolver: MultiFactorResolver,
    verificationId: string,
    verificationCode: string
  ): Promise<AppUser | null> {
    const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
    const assertion = PhoneMultiFactorGenerator.assertion(credential);
    const userCredential = await resolver.resolveSignIn(assertion);
    return loadProfile(userCredential.user.uid);
  }

  /**
   * Popup-only, deliberately simple. Previously environment-aware (popup
   * locally, redirect in production) with a redirect fallback layered on
   * top (timeout race + sessionStorage flag + completeGoogleRedirect) to
   * handle popup failing. That whole fallback system is removed: this
   * app already has a fallback sign-in method sitting right next to the
   * Google button on the same page (email/password), so a fallback
   * *inside* loginWithGoogle was solving a problem the page already
   * solves at a simpler layer. If popup is ever blocked, the person sees
   * a clear error and can use email/password instead, rather than the
   * app silently attempting a full-page redirect on their behalf.
   *
   * This also makes the root cause of this whole investigation
   * ("Database is closing/hidden") structurally impossible now, not
   * just avoided: getRedirectResult() is never called anywhere in this
   * app, so there is no second Firebase Auth operation that could ever
   * race with signInWithPopup's own IndexedDB usage.
   */
  async function handleGoogleUser(user: FirebaseUser): Promise<AppUser | null> {
    const existing = await getDoc(doc(db, "users", user.uid));
    if (!existing.exists()) {
      await createMinimalProfile(user.uid, user.displayName ?? "Neighbor", user.email ?? "", user.photoURL);
    }
    return loadProfile(user.uid);
  }

  async function loginWithGoogle(): Promise<AppUser | null> {
    // Reentrancy guard - protects any caller of this function, not just
    // one button's own disabled-while-busy UI state, from triggering a
    // second concurrent signInWithPopup while one is already in flight.
    if (googleSignInInFlight) {
      throw Object.assign(new Error("A Google sign-in attempt is already in progress."), {
        code: "auth/cancelled-popup-request",
      });
    }
    googleSignInInFlight = true;

    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
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
    } finally {
      googleSignInInFlight = false;
    }
  }

  /**
   * Links a Google account to the currently signed-in user (who signed
   * up/in with email+password). Unlike loginWithGoogle, this does not
   * create or load a new profile - the person is already signed in and
   * already has one. Firebase tracks linked providers on the User object
   * itself (firebaseUser.providerData) - no separate Firestore field
   * needed, avoiding a second source of truth that could drift out of
   * sync with what Firebase Auth actually has linked.
   */
  async function linkGoogleAccount(): Promise<void> {
    if (!auth.currentUser) {
      throw new Error("You must be signed in to link a Google account.");
    }
    if (googleSignInInFlight) {
      throw Object.assign(new Error("A Google sign-in attempt is already in progress."), {
        code: "auth/cancelled-popup-request",
      });
    }
    googleSignInInFlight = true;
    try {
      const result = await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      setFirebaseUser(result.user);
    } finally {
      googleSignInInFlight = false;
    }
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

  /**
   * Updates both Firebase Auth's own displayName and the Firestore
   * profile's name field - kept in sync deliberately, since some paths
   * (the self-healing branch in the onAuthStateChanged listener, for a
   * profile that's missing entirely) read user.displayName from Firebase
   * Auth directly, not from Firestore.
   */
  async function updateDisplayName(name: string) {
    if (!auth.currentUser) {
      throw new Error("You must be signed in to update your name.");
    }
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Name cannot be empty.");
    }
    await updateProfile(auth.currentUser, { displayName: trimmed });
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      name: trimmed,
      updatedAt: serverTimestamp(),
    });
    setFirebaseUser(auth.currentUser);
    await refreshProfile();
  }

  async function updateUserPhoto(photoUrl: string) {
    if (!auth.currentUser) {
      throw new Error("You must be signed in to update your photo.");
    }
    await updateProfile(auth.currentUser, { photoURL: photoUrl });
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      photoUrl,
      updatedAt: serverTimestamp(),
    });
    setFirebaseUser(auth.currentUser);
    await refreshProfile();
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
        linkGoogleAccount,
        logout,
        resetPassword,
        resendVerificationEmail,
        refreshEmailVerified,
        beginTotpEnrollment,
        confirmTotpEnrollment,
        unenrollMfaFactor,
        getMfaResolver,
        completeTotpSignIn,
        beginPhoneMfaEnrollment,
        confirmPhoneMfaEnrollment,
        beginPhoneMfaChallenge,
        completePhoneMfaSignIn,
        refreshProfile,
        updateDisplayName,
        updateUserPhoto,
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
