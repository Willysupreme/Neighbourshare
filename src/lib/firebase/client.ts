// Client-side Firebase initialization.
// All values come from NEXT_PUBLIC_* env vars (safe to expose to the browser -
// Firebase web config is not a secret; access control is enforced by
// Firestore Security Rules, not by hiding this config).
// See Deployment_and_Source_Links.txt and .env.example for the variables
// you must set in Vercel project settings.

import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Explicit Auth initialization, replacing the previous implicit getAuth().
// Firebase's implicit default persistence/resolver resolution was the one
// piece of the client Auth architecture that was never deterministic -
// confirmed by an explicit audit of every Firebase initialization call
// site in the codebase, which found the singleton app/auth pattern
// otherwise already correct (one app, one auth instance, no duplicate
// listeners anywhere).
//
// persistence is an explicit, ordered fallback chain: try IndexedDB first
// (the standard choice, survives tab/browser close), fall back to
// browserLocalPersistence (localStorage-based) if IndexedDB is genuinely
// unavailable, and inMemoryPersistence as a last resort (session survives
// only as long as the page itself - never silently fails to authenticate).
// popupRedirectResolver is likewise explicit rather than
// implicitly resolved.
//
// initializeAuth() with browserPopupRedirectResolver/
// indexedDBLocalPersistence eagerly instantiates browser-specific
// classes at init time. Next.js still performs an initial server-side
// render pass for "use client" components to produce the first HTML,
// meaning this module's top-level code runs once in Node.js - where
// window/document/IndexedDB don't exist - which crashes with Firebase's
// own "INTERNAL ASSERTION FAILED: Expected a class definition" (a
// documented, known failure mode: github.com/firebase/firebase-js-sdk
// issues #5475, #3181, #6265, all showing the identical
// CompatPopupRedirectResolver/_initializeWithPersistence stack trace
// this app also produced, found via live server-log testing after this
// fix was first written, not assumed in advance).
//
// The explicit persistence/resolver configuration is only meaningful
// in an actual browser anyway, so it is only attempted there;
// initializeAuth() throws if called more than once on the same app
// (e.g. under HMR re-executing this module), so also falls back to
// getAuth() in that case.
function initAuth() {
  if (typeof window === "undefined") {
    // Server-side render pass - getAuth() does not eagerly instantiate
    // the browser-only resolver/persistence classes that crash here.
    return getAuth(firebaseApp);
  }
  try {
    return initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

export const auth = initAuth();
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
