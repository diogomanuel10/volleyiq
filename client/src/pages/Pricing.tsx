import { Check, Loader2, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import type { Team } from "@shared/schema";

type PlanId = "basic" | "pro" | "club";

export default function Pricing() {
  const { team } = useTeam();
  const { t } = useTranslation();
  const qc = useQueryClient();

  const plans = [
    {
      id: "basic" as PlanId,
      name: t("pricing.plans.basic.name"),
      price: t("pricing.plans.basic.price"),
      blurb: t("pricing.plans.basic.blurb"),
      features: [
        t("pricing.features.basic.teams"),
        t("pricing.features.basic.liveScouting"),
        t("pricing.features.basic.basicMetrics"),
        t("pricing.features.basic.matchLimit"),
      ],
    },
    {
      id: "pro" as PlanId,
      name: t("pricing.plans.pro.name"),
      price: t("pricing.plans.pro.price"),
      period: t("pricing.plans.pro.period"),
      blurb: t("pricing.plans.pro.blurb"),
      featured: true,
      features: [
        t("pricing.features.pro.teams"),
        t("pricing.features.pro.analytics"),
        t("pricing.features.pro.aiPatterns"),
        t("pricing.features.pro.aiTraining"),
        t("pricing.features.pro.pdfReports"),
        t("pricing.features.pro.scenario"),
        t("pricing.features.pro.videoTagging"),
      ],
    },
    {
      id: "club" as PlanId,
      name: t("pricing.plans.club.name"),
      price: t("pricing.plans.club.price"),
      period: t("pricing.plans.club.period"),
      blurb: t("pricing.plans.club.blurb"),
      features: [
        t("pricing.features.club.teams"),
        t("pricing.features.club.allPro"),
        t("pricing.features.club.payments"),
        t("pricing.features.club.api"),
        t("pricing.features.club.support"),
      ],
    },
  ];

  const changePlan = useMutation({
    mutationFn: (plan: PlanId) =>
      api.patch<Team>(`/api/teams/${team!.id}/plan`, { plan }),
    onSuccess: (updated) => {
      qc.setQueryData<Team[]>(["teams"], (prev) =>
        prev?.map((x) => (x.id === updated.id ? updated : x)) ?? prev,
      );
      toast.success(t("pricing.planChanged", { plan: updated.plan.toUpperCase() }));
    },
    onError: () => toast.error(t("pricing.planChangeError")),
  });

  const current = team?.plan as PlanId | undefined;

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-8">
      <header className="text-center space-y-2">
        <Badge variant="outline" className="gap-1 mx-auto">
          <Sparkles className="h-3 w-3" /> {t("pricing.simplePricing")}
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t("pricing.title")}
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t("pricing.subtitle")}
        </p>
        {team && (
          <p className="text-xs text-muted-foreground">
            {t("pricing.currentTeam")} <b>{team.name}</b> —{" "}
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
                  <Badge>{t("pricing.mostPopular")}</Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="secondary">{t("pricing.currentPlan")}</Badge>
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
                      <Loader2 className="h-4 w-4 animate-spin" /> {t("pricing.changing")}
                    </>
                  ) : isCurrent ? (
                    t("pricing.currentPlan")
                  ) : current === "basic" ? (
                    t("pricing.upgradeTo", { plan: p.name })
                  ) : (
                    t("pricing.switchTo", { plan: p.name })
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        {t("pricing.billingNote")}
      </p>
    </div>
  );
}
