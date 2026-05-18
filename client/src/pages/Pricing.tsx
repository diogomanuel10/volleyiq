import { useState } from "react";
import { Check, Loader2, Sparkles, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import type { Team } from "@shared/schema";
import type { Plan } from "@shared/types";

// ── Config de planos (fonte única para Pricing e Onboarding) ──────────────────

const PLAN_ORDER: Plan[] = ["individual", "pro", "club"];

const PLANS_CONFIG = [
  {
    id: "individual" as Plan,
    name: "Individual",
    monthlyPrice: 19,
    blurb: "Para treinadores individuais",
    features: [
      "1 equipa · 1 utilizador",
      "Live scouting completo",
      "Analytics básico",
      "Match Day",
      "Até 20 jogos",
      "3 relatórios PDF / mês",
    ],
  },
  {
    id: "pro" as Plan,
    name: "Pro",
    monthlyPrice: 49,
    blurb: "Para treinadores com múltiplas equipas",
    popular: true,
    features: [
      "5 equipas · 1 utilizador / equipa",
      "Scouting de adversários",
      "Analytics completo",
      "Scenario modeling",
      "AI pattern detection",
      "Relatórios PDF ilimitados",
      "Export CSV",
    ],
  },
  {
    id: "club" as Plan,
    name: "Club",
    monthlyPrice: 119,
    blurb: "Para clubes com múltiplas equipas",
    features: [
      "Equipas ilimitadas · 1 utilizador / equipa",
      "Tudo do Pro",
      "AI training plans",
      "Sugestões IA em tempo real",
      "Dashboard de clube",
      "Suporte prioritário",
    ],
  },
] as const;

function annualPrice(monthly: number) {
  return Math.round(monthly * 0.85);
}

function planRank(plan: Plan): number {
  const p = plan === "basic" ? "individual" : plan;
  return PLAN_ORDER.indexOf(p as Plan);
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Pricing() {
  const { team, teams } = useTeam();
  const qc = useQueryClient();
  const [annual, setAnnual] = useState(false);

  const changePlan = useMutation({
    mutationFn: (plan: Plan) =>
      api.patch<Team>(`/api/teams/${team!.id}/plan`, { plan }),
    onSuccess: (updated) => {
      qc.setQueryData<Team[]>(["teams"], (prev) =>
        prev?.map((x) => (x.id === updated.id ? updated : x)) ?? prev,
      );
      toast.success(`Plano alterado para ${updated.plan.charAt(0).toUpperCase() + updated.plan.slice(1)}`);
    },
    onError: () => toast.error("Falha ao alterar plano. Tenta novamente."),
  });

  const current = (team?.plan ?? "individual") as Plan;
  const currentRank = planRank(current);

  return (
    <div className="p-4 md:p-8 max-w-screen-xl mx-auto space-y-8">
      {/* Header */}
      <header className="text-center space-y-3">
        <Badge variant="outline" className="gap-1 mx-auto">
          <Sparkles className="h-3 w-3" /> Preços simples
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Escolhe o plano certo para a tua equipa
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          7 dias grátis com acesso completo. Sem cartão de crédito. Cancela a qualquer momento.
        </p>
        {team && (
          <p className="text-xs text-muted-foreground">
            Equipa actual: <b>{team.name}</b>
            {" — "}
            <Badge variant="secondary" className="ml-1">
              {current.charAt(0).toUpperCase() + current.slice(1)}
            </Badge>
          </p>
        )}
      </header>

      {/* Toggle mensal / anual */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn(
          "text-sm transition-colors",
          !annual ? "font-semibold text-foreground" : "text-muted-foreground",
        )}>
          Mensal
        </span>
        <button
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual(v => !v)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            annual ? "bg-primary" : "bg-input",
          )}
        >
          <span className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            annual ? "translate-x-6" : "translate-x-1",
          )} />
        </button>
        <span className={cn(
          "text-sm transition-colors flex items-center gap-1.5",
          annual ? "font-semibold text-foreground" : "text-muted-foreground",
        )}>
          Anual
          <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 rounded-full px-1.5 py-0.5">
            −15%
          </span>
        </span>
      </div>

      {/* Cards */}
      <section className="grid gap-4 md:grid-cols-3">
        {PLANS_CONFIG.map((p) => {
          const isCurrent = planRank(current) === planRank(p.id);
          const isPending = changePlan.isPending && changePlan.variables === p.id;
          const planRankVal = planRank(p.id);
          const isUpgrade = planRankVal > currentRank;
          const isDowngrade = planRankVal < currentRank;
          const price = annual ? annualPrice(p.monthlyPrice) : p.monthlyPrice;
          const yearlySaving = (p.monthlyPrice - annualPrice(p.monthlyPrice)) * 12;

          return (
            <Card
              key={p.id}
              className={cn(
                "relative flex flex-col transition-shadow",
                "popular" in p && p.popular && "border-primary shadow-lg md:-translate-y-2",
                isCurrent && "ring-2 ring-primary",
              )}
            >
              {/* Badge topo */}
              {isCurrent ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="secondary">Plano actual</Badge>
                </div>
              ) : "popular" in p && p.popular ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge>Mais popular</Badge>
                </div>
              ) : null}

              <CardHeader className="pb-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {p.name}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">€{price}</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                {annual && (
                  <p className="text-xs text-emerald-600 font-medium">
                    Poupas €{yearlySaving}/ano · faturado €{price * 12}/ano
                  </p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col pt-0">
                <ul className="space-y-2 text-sm flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-6 w-full"
                  variant={"popular" in p && p.popular ? "default" : "outline"}
                  disabled={!team || isCurrent || isPending}
                  onClick={() => changePlan.mutate(p.id)}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> A mudar…
                    </>
                  ) : isCurrent ? (
                    <><Minus className="h-3.5 w-3.5 mr-1" /> Plano actual</>
                  ) : isUpgrade ? (
                    <><ArrowUp className="h-3.5 w-3.5 mr-1" /> Fazer upgrade para {p.name}</>
                  ) : (
                    <><ArrowDown className="h-3.5 w-3.5 mr-1" /> Mudar para {p.name}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Nota utilizadores adicionais */}
      <div className="text-center space-y-1">
        <p className="text-xs text-muted-foreground">
          Utilizadores adicionais disponíveis em todos os planos por <b>+€5 / utilizador / mês</b>
        </p>
        <p className="text-xs text-muted-foreground">
          7 dias grátis com acesso completo · Sem cartão de crédito · Cancela a qualquer momento
        </p>
      </div>
    </div>
  );
}
