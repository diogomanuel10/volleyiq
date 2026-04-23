import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "volleyiq:theme";
const LIGHT_META = "#ffffff";
const DARK_META = "#0f172a";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStored(): Theme {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark") return v;
  // Primeira visita: herda do SO, depois passa a ser explícito assim que o
  // utilizador carregar no toggle.
  return getSystemTheme();
}

function applyToDocument(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? DARK_META : LIGHT_META;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let current: Theme = getStored();

function notify() {
  for (const l of listeners) l();
}

export function setTheme(theme: Theme) {
  current = theme;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }
  applyToDocument(theme);
  notify();
}

export function toggleTheme() {
  setTheme(current === "dark" ? "light" : "dark");
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => "light" as Theme,
  );
  return { theme, setTheme, toggle: toggleTheme };
}
