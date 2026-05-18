import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Users, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logout } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import type { Team } from "@shared/schema";
import type { Plan } from "@shared/types";

// ── Dados dos planos ──────────────────────────────────────────────────────────

const PLANS_CONFIG = [
  {
    id: "individual" as Plan,
    name: "Individual",
    monthlyPrice: 19,
    blurb: "Para treinadores individuais",
    features: [
      "1 equipa",
      "Live scouting completo",
      "Analytics básico",
      "Match Day",
      "Até 20 jogos",
      "3 PDFs / mês",
    ],
  },
  {
    id: "pro" as Plan,
    name: "Pro",
    monthlyPrice: 49,
    blurb: "Para treinadores com múltiplas equipas",
    popular: true,
    features: [
      "5 equipas",
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
      "Equipas ilimitadas",
      "Tudo do Pro",
      "AI training plans",
      "Sugestões IA em tempo real",
      "Dashboard de clube",
      "Suporte prioritário",
    ],
  },
] as const;

interface FormState {
  name: string;
  club: string;
  category: string;
  season: string;
  division: string;
  primaryColor: string;
}

const INITIAL: FormState = {
  name: "",
  club: "",
  category: "",
  season: "",
  division: "",
  primaryColor: "#0ea5e9",
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function Onboarding() {
  const { t } = useTranslation();
  const [step, setStep] = useState<"plan" | "team">("plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan>("pro");
  const [mode, setMode] = useState<"create" | "join">("create");

  return (
    <div className="min-h-full flex items-center justify-center p-4 md:p-8 bg-background">
      <div className="w-full max-w-3xl space-y-6">

        {/* Logo */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">V</span>
            </div>
            <span className="font-bold text-lg">VolleyIQ</span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className={cn(
            "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors",
            step === "plan"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-primary bg-primary text-primary-foreground",
          )}>
            {step === "team" ? <Check className="h-3.5 w-3.5" /> : "1"}
          </div>
          <div className={cn("h-px w-12 transition-colors", step === "team" ? "bg-primary" : "bg-border")} />
          <div className={cn(
            "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors",
            step === "team"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground",
          )}>
            2
          </div>
        </div>

        {step === "plan" ? (
          <PlanStep
            selected={selectedPlan}
            onSelect={setSelectedPlan}
            onContinue={() => setStep("team")}
          />
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">
                {t("onboarding.welcome")}
              </h1>
              <p className="mt-1.5 text-muted-foreground text-sm">
                {t("onboarding.subtitle")}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium transition-colors",
                  mode === "create"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground",
                )}
                onClick={() => setMode("create")}
              >
                {t("onboarding.createTeam")}
              </button>
              <button
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium transition-colors",
                  mode === "join"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground",
                )}
                onClick={() => setMode("join")}
              >
                {t("onboarding.joinTeam")}
              </button>
            </div>

            {mode === "create"
              ? <CreateTeamForm plan={selectedPlan} />
              : <JoinTeamForm />
            }

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("plan")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Mudar plano
              </Button>
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                {t("onboarding.logout")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Passo 1: Seleção de plano ─────────────────────────────────────────────────

function PlanStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: Plan;
  onSelect: (p: Plan) => void;
  onContinue: () => void;
}) {
  const [annual, setAnnual] = useState(false);

  function annualPrice(monthly: number) {
    return Math.round(monthly * 0.85);
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Escolhe o teu plano</h1>
        <p className="mt-1.5 text-muted-foreground text-sm">
          7 dias grátis com acesso completo · Sem cartão de crédito
        </p>
      </div>

      {/* Toggle mensal / anual */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn("text-sm transition-colors", !annual ? "font-semibold text-foreground" : "text-muted-foreground")}>
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
        <span className={cn("text-sm transition-colors flex items-center gap-1.5", annual ? "font-semibold text-foreground" : "text-muted-foreground")}>
          Anual
          <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 rounded-full px-1.5 py-0.5">
            −15%
          </span>
        </span>
      </div>

      {/* Cards de plano */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PLANS_CONFIG.map((plan) => {
          const price = annual ? annualPrice(plan.monthlyPrice) : plan.monthlyPrice;
          const isSelected = selected === plan.id;

          return (
            <button
              key={plan.id}
              onClick={() => onSelect(plan.id)}
              className={cn(
                "relative text-left rounded-xl border p-5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                  : "border-border hover:border-border/80 hover:bg-accent/40",
              )}
            >
              {"popular" in plan && plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                    Mais popular
                  </span>
                </div>
              )}

              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {plan.name}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">€{price}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  {annual && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Faturado €{price * 12}/ano
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">{plan.blurb}</div>
                </div>

                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>

      <Button className="w-full" size="lg" onClick={onContinue}>
        Continuar com {PLANS_CONFIG.find(p => p.id === selected)?.name} — trial de 7 dias
        <ArrowRight className="h-4 w-4 ml-1" />
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Sem cartão de crédito · Cancela a qualquer momento
      </p>
    </div>
  );
}

// ── Passo 2: Criar equipa ─────────────────────────────────────────────────────

function CreateTeamForm({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [showOptional, setShowOptional] = useState(false);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: FormState) =>
      api.post<Team>("/api/teams", {
        name: data.name.trim(),
        club: data.club.trim(),
        category: data.category.trim(),
        season: data.season.trim() || null,
        division: data.division.trim() || null,
        primaryColor: data.primaryColor || null,
        plan,
      }),
    onSuccess: () => {
      toast.success(t("onboarding.form.created"));
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err: any) => {
      if (err?.body?.error === "plan_limit_teams") {
        toast.error(`Limite de ${err.body.maxTeams} equipa(s) atingido. Faz upgrade do plano para criar mais equipas.`);
      } else {
        toast.error(t("onboarding.form.createError"), {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.club.trim() || !form.category.trim()) {
      toast.error(t("onboarding.form.required"));
      return;
    }
    mutation.mutate(form);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border bg-card p-6 md:p-8 space-y-5 shadow-sm"
    >
      <div className="grid gap-2">
        <Label htmlFor="name">
          {t("onboarding.form.teamName")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          autoFocus
          required
          placeholder={t("onboarding.form.teamNamePlaceholder")}
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          disabled={mutation.isPending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="club">
          {t("onboarding.form.club")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="club"
          required
          placeholder={t("onboarding.form.clubPlaceholder")}
          value={form.club}
          onChange={(e) => update("club", e.target.value)}
          disabled={mutation.isPending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category">
          {t("onboarding.form.category")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="category"
          required
          placeholder={t("onboarding.form.categoryPlaceholder")}
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
          disabled={mutation.isPending}
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              showOptional && "rotate-180",
            )}
          />
          {t("onboarding.form.optionalDetails")}
        </button>

        {showOptional && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="season">{t("onboarding.form.season")}</Label>
                <Input
                  id="season"
                  placeholder={t("onboarding.form.seasonPlaceholder")}
                  value={form.season}
                  onChange={(e) => update("season", e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="division">{t("onboarding.form.division")}</Label>
                <Input
                  id="division"
                  placeholder={t("onboarding.form.divisionPlaceholder")}
                  value={form.division}
                  onChange={(e) => update("division", e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="primaryColor">{t("onboarding.form.primaryColor")}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="primaryColor"
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => update("primaryColor", e.target.value)}
                  disabled={mutation.isPending}
                  className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
                  aria-label={t("onboarding.form.primaryColor")}
                />
                <Input
                  value={form.primaryColor}
                  onChange={(e) => update("primaryColor", e.target.value)}
                  disabled={mutation.isPending}
                  placeholder="#0ea5e9"
                  className="max-w-[140px] font-mono"
                />
                <div
                  aria-hidden
                  className="h-10 flex-1 rounded-md border"
                  style={{ backgroundColor: form.primaryColor }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={mutation.isPending}
        className="w-full"
      >
        {mutation.isPending ? t("onboarding.form.creating") : t("onboarding.form.createButton")}
      </Button>
    </form>
  );
}

// ── Passo 2 (alternativo): Juntar-se a uma equipa ─────────────────────────────

function JoinTeamForm() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const qc = useQueryClient();

  const normalized = code.trim().toUpperCase();

  const previewQuery = useQuery<{ id: string; name: string; club: string; category: string } | null>({
    queryKey: ["teamPreview", normalized],
    queryFn: async () => {
      if (normalized.length < 6) return null;
      try {
        return await api.get(`/api/teams/join/${normalized}`);
      } catch {
        return null;
      }
    },
    enabled: normalized.length === 6,
    staleTime: 30_000,
  });

  const joinMutation = useMutation({
    mutationFn: () => api.post<Team>("/api/teams/join", { code: normalized }),
    onSuccess: () => {
      toast.success(t("onboarding.join.joined"));
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err: any) => {
      const msg = err?.message ?? "";
      if (msg.includes("already_member")) {
        toast.error(t("onboarding.join.alreadyMember"));
      } else {
        toast.error(t("onboarding.join.invalidCode"));
      }
    },
  });

  const teamInfo = previewQuery.data;
  const codeOk = normalized.length === 6 && teamInfo != null;

  return (
    <div className="rounded-xl border bg-card p-6 md:p-8 space-y-5 shadow-sm">
      <div className="space-y-1">
        <Label htmlFor="invite-code">{t("onboarding.join.inviteCode")}</Label>
        <p className="text-xs text-muted-foreground">
          {t("onboarding.join.inviteCodeHint")}
        </p>
      </div>

      <Input
        id="invite-code"
        autoFocus
        placeholder={t("onboarding.join.placeholder")}
        value={code}
        onChange={(e) => {
          setCode(e.target.value.toUpperCase().slice(0, 6));
          setConfirmed(false);
        }}
        className="font-mono text-lg tracking-widest text-center"
        maxLength={6}
      />

      {normalized.length === 6 && (
        <>
          {previewQuery.isLoading && (
            <p className="text-xs text-muted-foreground text-center">
              {t("onboarding.join.verifying")}
            </p>
          )}
          {!previewQuery.isLoading && teamInfo && (
            <div className="rounded-lg border bg-muted/40 p-4 flex items-start gap-3">
              <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">{teamInfo.name}</p>
                <p className="text-xs text-muted-foreground">
                  {teamInfo.club} · {teamInfo.category}
                </p>
              </div>
            </div>
          )}
          {!previewQuery.isLoading && !teamInfo && (
            <p className="text-xs text-destructive text-center">
              {t("onboarding.join.notFound")}
            </p>
          )}
        </>
      )}

      <Button
        className="w-full"
        disabled={!codeOk || joinMutation.isPending}
        onClick={() => joinMutation.mutate()}
      >
        {joinMutation.isPending ? t("onboarding.join.joining") : t("onboarding.join.joinButton")}
      </Button>
    </div>
  );
}
