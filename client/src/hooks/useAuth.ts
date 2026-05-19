import { useEffect, useState } from "react";
import { subscribeAuth } from "@/lib/firebase";

interface AuthUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
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
    });
    return () => unsub && unsub();
  }, []);

  return {
    user: user === "loading" ? null : user,
    isLoading: user === "loading",
    isAuthed: user !== "loading" && user !== null,
  };
}
