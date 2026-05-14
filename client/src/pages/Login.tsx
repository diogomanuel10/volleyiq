import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginEmail, loginGoogle, registerEmail } from "@/lib/firebase";

const DEV = import.meta.env.VITE_USE_DEV_AUTH === "true";

export default function Login() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function authErrorMessage(err: any): string {
    switch (err?.code) {
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return t("login.errors.wrongPassword");
      case "auth/user-not-found":
        return t("login.errors.userNotFound");
      case "auth/email-already-in-use":
        return t("login.errors.emailInUse");
      case "auth/weak-password":
        return t("login.errors.weakPassword");
      case "auth/invalid-email":
        return t("login.errors.invalidEmail");
      case "auth/too-many-requests":
        return t("login.errors.tooManyRequests");
      case "auth/network-request-failed":
        return t("login.errors.networkFailed");
      case "auth/unauthorized-domain":
        return t("login.errors.unauthorizedDomain");
      case "auth/popup-closed-by-user":
        return t("login.errors.popupClosed");
      case "auth/cancelled-popup-request":
        return ""; // silent
      default:
        return err?.message ?? t("login.errors.authFailed");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") await loginEmail(email, password);
      else await registerEmail(email, password);
      window.location.reload();
    } catch (err: any) {
      const msg = authErrorMessage(err);
      if (msg) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full grid place-items-center p-6 bg-gradient-to-br from-primary/5 via-background to-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">
              V
            </div>
            <CardTitle className="text-xl">VolleyIQ</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? t("login.signIn") : t("login.register")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {DEV && (
            <div
              className="rounded-md border border-dashed bg-muted/50 p-3 text-xs text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: t("login.devMode") }}
            />
          )}
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={!DEV}
                placeholder="treinador@clube.pt"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!DEV}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === "login" ? t("login.submit") : t("login.submitRegister")}
            </Button>
          </form>
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              try {
                await loginGoogle();
              } catch (err: any) {
                const msg = authErrorMessage(err);
                if (msg) toast.error(msg);
              }
            }}
          >
            {t("login.continueWithGoogle")}
          </Button>
          <button
            className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? t("login.noAccount") : t("login.hasAccount")}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
