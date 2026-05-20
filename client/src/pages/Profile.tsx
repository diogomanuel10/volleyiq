import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { KeyRound, User as UserIcon, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTeam } from "@/hooks/useTeam";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { changePassword, isEmailUser } from "@/lib/firebase";
import { PLAN_LABELS } from "@shared/planFeatures";

export default function Profile() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { team, isSubscribed, trialDaysLeft, isTrialExpired } = useTeam();
  const { plan: effectivePlan } = usePlanGuard();
  const emailProvider = isEmailUser();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error(t("profile.errors.mismatch"));
      return;
    }
    if (next.length < 6) {
      toast.error(t("profile.errors.tooShort"));
      return;
    }
    setLoading(true);
    try {
      await changePassword(current, next);
      toast.success(t("profile.success"));
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err: any) {
      const code = err?.code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        toast.error(t("profile.errors.wrongCurrent"));
      } else if (code === "auth/too-many-requests") {
        toast.error(t("profile.errors.tooMany"));
      } else {
        toast.error(t("profile.errors.generic"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {t("profile.title")}
        </h1>
      </header>

      {/* Plan info */}
      {team && (
        <div className="rounded-lg border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            Plano actual
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="uppercase text-xs">
                {PLAN_LABELS[effectivePlan]}
              </Badge>
              {isSubscribed ? (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Activo
                </span>
              ) : isTrialExpired ? (
                <span className="text-xs text-destructive">Trial expirado</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                  Trial · {trialDaysLeft === 0 ? "expira hoje" : trialDaysLeft === 1 ? "1 dia restante" : `${trialDaysLeft} dias restantes`}
                </span>
              )}
            </div>
            {!isSubscribed && (
              <Link href="/pricing">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Fazer upgrade
                </Button>
              </Link>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Equipa: <span className="font-medium">{team.name}</span>
          </p>
        </div>
      )}

      {/* Account info */}
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          {t("profile.account")}
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          {user?.displayName && <p>{user.displayName}</p>}
          <p>{user?.email}</p>
        </div>
      </div>

      {/* Password change */}
      {emailProvider ? (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            {t("profile.changePassword")}
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="current">{t("profile.currentPassword")}</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="next">{t("profile.newPassword")}</Label>
              <Input
                id="next"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm">{t("profile.confirmPassword")}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t("common.saving") : t("profile.savePassword")}
            </Button>
          </form>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          {t("profile.googleAccount")}
        </div>
      )}
    </div>
  );
}
