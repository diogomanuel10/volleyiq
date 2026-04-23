import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

const USE_DEV = import.meta.env.VITE_USE_DEV_AUTH === "true";

interface DevUser {
  uid: string;
  email: string;
  displayName: string;
}

export type AppUser = User | DevUser;

const DEV_USER: DevUser = {
  uid: "dev-user",
  email: "dev@volleyiq.local",
  displayName: "Dev User",
};

let app: FirebaseApp | null = null;
let authReady: Promise<User | null> | null = null;

function getApp() {
  if (app || USE_DEV) return app;
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  if (!cfg.apiKey || !cfg.projectId || !cfg.appId) {
    throw new Error(
      "Firebase web config is missing. Set VITE_FIREBASE_API_KEY, " +
        "VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID and " +
        "VITE_FIREBASE_APP_ID on the frontend host (e.g. Vercel).",
    );
  }
  app = initializeApp(cfg);
  return app;
}

/**
 * Resolve-once promise that fires when Firebase restored (or confirmed the
 * absence of) a persisted session. Lets `getIdToken` wait on initial load
 * instead of returning a premature null.
 */
function ensureAuthReady(): Promise<User | null> {
  if (authReady) return authReady;
  getApp();
  const auth = getAuth();
  authReady = new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });
  return authReady;
}

function isFirebaseUser(user: AppUser | null): user is User {
  return !!user && "getIdToken" in user;
}

function waitForAuthState(): Promise<User | null> {
  return new Promise((resolve) => {
    getApp();
    const unsub = onAuthStateChanged(getAuth(), (user) => {
      unsub();
      resolve(user);
    });
  });
}

export function subscribeAuth(cb: (user: AppUser | null) => void) {
  if (USE_DEV) {
    const stored = localStorage.getItem("volleyiq:dev-auth");
    cb(stored === "out" ? null : DEV_USER);
    return () => {};
  }

  getApp();
  return onAuthStateChanged(getAuth(), cb);
}

export async function loginEmail(email: string, password: string) {
  if (USE_DEV) {
    localStorage.removeItem("volleyiq:dev-auth");
    return DEV_USER;
  }
  getApp();
  const cred = await signInWithEmailAndPassword(getAuth(), email, password);
  return cred.user;
}

export async function registerEmail(email: string, password: string) {
  if (USE_DEV) return DEV_USER;
  getApp();
  const cred = await createUserWithEmailAndPassword(getAuth(), email, password);
  return cred.user;
}

export async function loginGoogle() {
  if (USE_DEV) {
    localStorage.removeItem("volleyiq:dev-auth");
    return DEV_USER;
  }
  getApp();
  const cred = await signInWithPopup(getAuth(), new GoogleAuthProvider());
  return cred.user;
}

export async function logout() {
  if (USE_DEV) {
    localStorage.setItem("volleyiq:dev-auth", "out");
    window.location.reload();
    return;
  }
  getApp();
  await signOut(getAuth());
}

export async function getIdToken(): Promise<string | null> {
  if (USE_DEV) return "dev-token";
  const user = getAuth().currentUser;
  return user ? user.getIdToken() : null;
}