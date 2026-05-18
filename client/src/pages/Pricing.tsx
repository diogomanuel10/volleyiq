import { useState } from "react";
import { Check, Loader2, Sparkles, Zap, CreditCard, Smartphone, Building2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import type { Team } from "@shared/schema";

type PlanId = "individual" | "pro" | "club";
type Period = "monthly" | "annual";
type PayMethod = "multibanco" | "mb_way" | "cc";

const PLANS = [
  {
    id: "individual" as PlanId,
    name: "Individual",
    monthly: 19,
    annual: 16,
    blurb: "Para treinadores individuais",
    features: [
      "1 equipa",
      "Live scouting",
      "Métricas básicas",
      "Até 20 jogos",
      "3 PDFs/mês",
    ],
  },
  {
    id: "pro" as PlanId,
    name: "Pro",
    monthly: 49,
    annual: 41,
    blurb: "Para treinadores e clubes pequenos",
    featured: true,
    features: [
      "5 equipas",
      "Analytics completo",
      "AI pattern detection",
      "Adversários & scouting report",
      "Scenario modeling",
      "PDFs ilimitados",
      "Exportação CSV",
    ],
  },
  {
    id: "club" as PlanId,
    name: "Club",
    monthly: 119,
    annual: 101,
    blurb: "Para clubes com múltiplas equipas",
    features: [
      "Equipas ilimitadas",
      "Tudo do Pro",
      "AI training plans",
      "AI live suggestions",
      "Club dashboard",
      "Suporte prioritário",
    ],
  },
];

const PAY_METHODS: { id: PayMethod; label: string; icon: typeof CreditCard }[] = [
  { id: "multibanco", label: "Referência MB", icon: Building2 },
  { id: "mb_way", label: "MB WAY", icon: Smartphone },
  { id: "cc", label: "Cartão de crédito", icon: CreditCard },
];

interface CheckoutState {
  plan: PlanId;
  period: Period;
}

interface PaymentResult {
  mock?: boolean;
  message?: string;
  redirectUrl?: string;
  entity?: string;
  reference?: string;
  expiresAt?: string;
  team?: Team;
}

export default function Pricing() {
  const { team, isSubscribed, trialDaysLeft } = useTeam();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("monthly");
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>("multibanco");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payResult, setPayResult] = useState<PaymentResult | null>(null);

  const current = (team?.plan as PlanId | "basic") ?? "basic";
  const normalizedCurrent: PlanId | "basic" = current === "basic" ? "individual" : current;

  const planRank = (p: string) => {
    const order = ["basic", "individual", "pro", "club"];
    return order.indexOf(p);
  };

  const startCheckout = useMutation({
    mutationFn: (params: {
      plan: PlanId;
      period: Period;
      method: PayMethod;
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
    }) =>
      api.post<PaymentResult>("/api/payments/checkout", {
        teamId: team!.id,
        ...params,
      }),
    onSuccess: (data) => {
      if (data.mock) {
        // Sandbox: team was activated immediately
        qc.invalidateQueries({ queryKey: ["teams"] });
        toast.success("Subscrição activada!");
        setCheckout(null);
        return;
      }
      setPayResult(data);
    },
    onError: (err: any) => {
      toast.error(err?.body?.error === "payment_not_configured"
        ? "Pagamentos ainda não configurados."
        : "Falha ao iniciar pagamento. Tenta novamente.");
    },
  });

  function handleCheckoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkout) return;
    startCheckout.mutate({
      plan: checkout.plan,
      period: checkout.period,
      method: payMethod,
      customerName: name,
      customerEmail: email,
      customerPhone: phone || undefined,
    });
  }

  return (
    <div className="p-4 md:p-8 max-w-screen-xl mx-auto space-y-8">
      <header className="text-center space-y-3">
        <Badge variant="outline" className="gap-1 mx-auto">
          <Sparkles className="h-3 w-3" /> Preços simples
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Escolhe o plano certo para a tua equipa
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          7 dias grátis em qualquer plano. Sem compromisso.
        </p>

        {team && (
          <p className="text-xs text-muted-foreground">
            Equipa actual: <b>{team.name}</b>{" "}
            <Badge variant="secondary" className="uppercase ml-1">
              {isSubscribed ? team.plan : `trial — ${trialDaysLeft}d`}
            </Badge>
          </p>
        )}

        {/* Monthly / Annual toggle */}
        <div className="inline-flex items-center gap-1 rounded-full border p-1 text-sm mt-2">
          <button
            onClick={() => setPeriod("monthly")}
            className={cn(
              "rounded-full px-4 py-1 transition-colors",
              period === "monthly" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            Mensal
          </button>
          <button
            onClick={() => setPeriod("annual")}
            className={cn(
              "rounded-full px-4 py-1 transition-colors",
              period === "annual" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            Anual <Badge variant="outline" className="ml-1 text-xs">-15%</Badge>
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = normalizedCurrent === p.id && isSubscribed;
          const price = period === "annual" ? p.annual : p.monthly;
          const isUpgrade = planRank(p.id) > planRank(normalizedCurrent);

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
                  <span className="text-3xl font-bold">€{price}</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                  {period === "annual" && (
                    <span className="text-xs text-muted-foreground ml-1">(faturado anualmente)</span>
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
                  className="mt-6 w-full gap-2"
                  variant={p.featured ? "default" : "outline"}
                  disabled={!team || isCurrent}
                  onClick={() => setCheckout({ plan: p.id, period })}
                >
                  <Zap className="h-4 w-4" />
                  {isCurrent
                    ? "Plano actual"
                    : isUpgrade
                    ? `Fazer upgrade — €${price}/mês`
                    : `Subscrever — €${price}/mês`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Pagamento via MB WAY, Referência Multibanco ou Cartão. Powered by EasyPay.
      </p>

      {/* Checkout dialog */}
      <Dialog open={!!checkout && !payResult} onOpenChange={(o) => { if (!o) setCheckout(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Subscrever {PLANS.find((p) => p.id === checkout?.plan)?.name}
            </DialogTitle>
            <DialogDescription>
              €{checkout && (checkout.period === "annual"
                ? PLANS.find((p) => p.id === checkout.plan)!.annual
                : PLANS.find((p) => p.id === checkout.plan)!.monthly)}/mês
              {checkout?.period === "annual" ? " · faturado anualmente" : " · faturado mensalmente"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCheckoutSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Método de pagamento</Label>
              <div className="grid grid-cols-3 gap-2">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPayMethod(m.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors",
                      payMethod === m.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    <m.icon className="h-5 w-5" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João Silva"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@exemplo.pt"
              />
            </div>

            {payMethod === "mb_way" && (
              <div className="space-y-1">
                <Label htmlFor="phone">Telemóvel (MB WAY)</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+351 9XX XXX XXX"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={startCheckout.isPending}
            >
              {startCheckout.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> A processar…</>
              ) : (
                <><Zap className="h-4 w-4" /> Confirmar pagamento</>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment result dialog */}
      <Dialog open={!!payResult} onOpenChange={(o) => { if (!o) setPayResult(null); }}>
        <DialogContent className="max-w-sm text-center space-y-4">
          <DialogHeader>
            <DialogTitle>Pagamento iniciado</DialogTitle>
          </DialogHeader>

          {payResult?.reference && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Usa os dados abaixo para pagar por Referência Multibanco:</p>
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entidade</span>
                  <span className="font-mono font-bold">{payResult.entity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Referência</span>
                  <span className="font-mono font-bold tracking-widest">{payResult.reference}</span>
                </div>
                {payResult.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expira</span>
                    <span>{new Date(payResult.expiresAt).toLocaleDateString("pt-PT")}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Após o pagamento, a subscrição é activada automaticamente (normalmente em segundos).
              </p>
            </div>
          )}

          {payResult?.redirectUrl && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Clica para completar o pagamento em segurança.
              </p>
              <Button className="w-full" onClick={() => window.open(payResult.redirectUrl, "_blank")}>
                Pagar agora
              </Button>
            </div>
          )}

          {payResult?.mock && (
            <p className="text-sm text-green-600">✓ {payResult.message}</p>
          )}

          <Button variant="outline" className="w-full" onClick={() => setPayResult(null)}>
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
