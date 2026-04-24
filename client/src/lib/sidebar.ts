import { useSyncExternalStore } from "react";

const STORAGE_KEY = "volleyiq:sidebar-collapsed";

function getStored(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

let current = getStored();
const listeners = new Set<() => void>();

function setCollapsed(v: boolean) {
  current = v;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  }
  for (const l of listeners) l();
}

export function toggleSidebar() {
  setCollapsed(!current);
}

export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => false,
  );
  return { collapsed, toggle: toggleSidebar, set: setCollapsed };
}
