import { Check, Loader2, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import type { Team } from "@shared/schema";

type PlanId = "basic" | "pro" | "club";

interface Plan {
  id: PlanId;
  name: string;
  price: string;
  period?: string;
  blurb: string;
  featured?: boolean;
  features: string[];
}

const plans: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: "Grátis",
    blurb: "Para experimentar o produto",
    features: [
      "1 equipa",
      "Live scouting",
      "Métricas básicas",
      "Limite de 10 jogos",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "€29",
    period: "/mês",
    blurb: "Para treinadores e clubes pequenos",
    featured: true,
    features: [
      "5 equipas",
      "Analytics completo",
      "AI pattern detection",
      "AI training plans",
      "Relatórios PDF",
      "Scenario modeling",
      "Tagging de vídeo",
    ],
  },
  {
    id: "club",
    name: "Club",
    price: "€79",
    period: "/mês",
    blurb: "Para clubes com múltiplas equipas",
    features: [
      "Equipas ilimitadas",
      "Tudo do Pro",
      "Gestão de quotas e presenças",
      "Acesso API",
      "Suporte prioritário",
    ],
  },
];

export default function Pricing() {
  const { team } = useTeam();
  const qc = useQueryClient();

  const changePlan = useMutation({
    mutationFn: (plan: PlanId) =>
      api.patch<Team>(`/api/teams/${team!.id}/plan`, { plan }),
    onSuccess: (t) => {
      qc.setQueryData<Team[]>(["teams"], (prev) =>
        prev?.map((x) => (x.id === t.id ? t : x)) ?? prev,
      );
      toast.success(`Plano alterado para ${t.plan.toUpperCase()}`);
    },
    onError: () => toast.error("Falha ao alterar plano"),
  });

  const current = team?.plan as PlanId | undefined;

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-8">
      <header className="text-center space-y-2">
        <Badge variant="outline" className="gap-1 mx-auto">
          <Sparkles className="h-3 w-3" /> Preços simples
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Escolhe o plano certo para a tua equipa
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Começa grátis. Actualiza quando precisares de analytics avançado, IA ou
          gestão de clube.
        </p>
        {team && (
          <p className="text-xs text-muted-foreground">
            Equipa actual: <b>{team.name}</b> — plano{" "}
            <Badge variant="secondary" className="uppercase ml-1">
              {team.plan}
            </Badge>
          </p>
        )}
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = current === p.id;
          const isPending =
            changePlan.isPending && changePlan.variables === p.id;
          return (
            <Card
              key={p.id}
              className={cn(
                "relative flex flex-col",
                p.featured && "border-primary shadow-lg md:-translate-y-2",
                isCurrent && "ring-2 ring-primary",
              )}
            >
              {p.featured && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge>Mais popular</Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="secondary">Plano actual</Badge>
                </div>
              )}
              <CardHeader>
                <div className="text-lg font-semibold">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{p.price}</span>
                  {p.period && (
                    <span className="text-muted-foreground text-sm">
                      {p.period}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
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
                  variant={p.featured ? "default" : "outline"}
                  disabled={!team || isCurrent || isPending}
                  onClick={() => changePlan.mutate(p.id)}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> A mudar…
                    </>
                  ) : isCurrent ? (
                    "Plano actual"
                  ) : current === "basic" ? (
                    `Fazer upgrade para ${p.name}`
                  ) : (
                    `Mudar para ${p.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Billing mockado: mudar de plano altera o registo da equipa em SQLite e
        desbloqueia features no cliente. Integração Stripe/Mollie fica para uma
        fase seguinte.
      </p>
    </div>
  );
}
