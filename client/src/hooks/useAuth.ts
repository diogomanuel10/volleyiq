import { useEffect, useState } from "react";
import { subscribeAuth } from "@/lib/firebase";
import { api } from "@/lib/api";
import i18n from "@/lib/i18n";

interface AuthUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

async function loadLanguagePreference() {
  try {
    const prefs = await api.get<{ language: string }>("/api/user/preferences");
    if (prefs?.language) {
      await i18n.changeLanguage(prefs.language);
      localStorage.setItem("volleyiq:lang", prefs.language);
    }
  } catch {
    // graceful fallback — use localStorage or default pt-PT
    const stored = localStorage.getItem("volleyiq:lang");
    if (stored) {
      await i18n.changeLanguage(stored);
    }
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null | "loading">("loading");

  useEffect(() => {
    const unsub = subscribeAuth((u) => {
      const authUser = u
        ? {
            uid: u.uid,
            email: "email" in u ? u.email : null,
            displayName:
              "displayName" in u
                ? u.displayName
                : "name" in u
                  ? (u as any).name
                  : null,
          }
        : null;
      setUser(authUser);
      if (authUser) {
        loadLanguagePreference();
      }
    });
    return () => unsub && unsub();
  }, []);

  return {
    user: user === "loading" ? null : user,
    isLoading: user === "loading",
    isAuthed: user !== "loading" && user !== null,
  };
}
