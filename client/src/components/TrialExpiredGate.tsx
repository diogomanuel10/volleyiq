import { Link } from "wouter";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeam } from "@/hooks/useTeam";

export function TrialExpiredGate({ children }: { children: React.ReactNode }) {
  const { isTrialExpired, isSubscribed, isLoading } = useTeam();

  if (isLoading || isSubscribed || !isTrialExpired) return <>{children}</>;

  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-7 h-7 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">Trial expirado</h2>
          <p className="text-sm text-muted-foreground">
            O teu período de 7 dias gratuitos terminou. Subscreve um plano para continuar a usar o VolleyIQ.
          </p>
        </div>

        <div className="space-y-2">
          <Link href="/pricing">
            <Button className="w-full gap-2">
              <Zap className="h-4 w-4" />
              Ver planos e subscrever
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground">
            Os teus dados estão guardados e acessíveis assim que subscreveres.
          </p>
        </div>
      </div>
    </div>
  );
}
