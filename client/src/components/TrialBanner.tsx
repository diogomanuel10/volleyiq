import { Link } from "wouter";
import { Clock, Zap } from "lucide-react";
import { useTeam } from "@/hooks/useTeam";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const { isSubscribed, trialDaysLeft, isTrialExpired } = useTeam();

  if (isSubscribed || isTrialExpired) return null;

  const urgent = trialDaysLeft <= 2;

  return (
    <div className={cn(
      "w-full px-4 py-2 flex items-center justify-between gap-3 text-xs font-medium border-b",
      urgent
        ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
        : "bg-primary/5 border-primary/20 text-primary",
    )}>
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        {trialDaysLeft === 0
          ? "O teu trial expira hoje"
          : trialDaysLeft === 1
          ? "Último dia de trial"
          : `${trialDaysLeft} dias de trial restantes`}
      </div>
      <Link href="/pricing">
        <button className={cn(
          "flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors",
          urgent
            ? "bg-amber-500/15 hover:bg-amber-500/25"
            : "bg-primary/10 hover:bg-primary/20",
        )}>
          <Zap className="h-3 w-3" />
          Subscrever agora
        </button>
      </Link>
    </div>
  );
}
