import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Target,
  Shield,
  Activity,
  Award,
  Swords,
  Sparkles,
  Database,
} from "lucide-react";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChart } from "@/components/charts/TrendChart";
import { TeamRadar } from "@/components/charts/TeamRadar";
import { RotationSideOut } from "@/components/charts/RotationSideOut";
import { cn, formatPct } from "@/lib/utils";

// Shape exacto do que `/api/stats/team/:teamId/dashboard` devolve.
interface DashboardStats {
  sampleMatches: number;
  sampleActions: number;
  kpis: {
    killPct: number;
    sideOutPct: number;
    passRating: number;
    serveAcePct: number;
    attackEfficiency: number;
    record: string;
  };
  trend: Array<{ label: string; killPct: number; sideOut: number }>;
  radar: Array<{ axis: string; value: number }>;
  rotation: Array<{ rotation: string; pct: number }>;
}

// Fallback apresentado quando a equipa ainda não tem acções registadas —
// evita um dashboard vazio no primeiro login sem confundir o utilizador.
const MOCK: DashboardStats = {
  sampleMatches: 6,
  sampleActions: 480,
  kpis: {
    killPct: 46.2,
    sideOutPct: 63.4,
    passRating: 2.31,
    serveAcePct: 8.7,
    attackEfficiency: 0.291,
    record: "12-4",
  },
  trend: [
    { label: "J-6", killPct: 41.0, sideOut: 58 },
    { label: "J-5", killPct: 43.2, sideOut: 60 },
    { label: "J-4", killPct: 44.0, sideOut: 61 },
    { label: "J-3", killPct: 45.8, sideOut: 62 },
    { label: "J-2", killPct: 44.2, sideOut: 65 },
    { label: "J-1", killPct: 46.2, sideOut: 63 },
  ],
  radar: [
    { axis: "Attack", value: 78 },
    { axis: "Serve", value: 64 },
    { axis: "Reception", value: 72 },
    { axis: "Block", value: 58 },
    { axis: "Dig", value: 70 },
    { axis: "Setting", value: 81 },
  ],
  rotation: [
    { rotation: "R1", pct: 68 },
    { rotation: "R2", pct: 61 },
    { rotation: "R3", pct: 55 },
    { rotation: "R4", pct: 72 },
    { rotation: "R5", pct: 47 },
    { rotation: "R6", pct: 64 },
  ],
};

export default function Dashboard() {
  const { team } = useTeam();

  const statsQuery = useQuery({
    queryKey: ["stats", team?.id],
    queryFn: () =>
      api.get<DashboardStats>(
        `/api/stats/team/${team!.id}/dashboard?teamId=${team!.id}`,
      ),
    enabled: !!team,
  });

  if (!team) return null;

  const real = statsQuery.data;
  // Se ainda não há acções suficientes, usamos o mock para o dashboard não
  // aparecer em branco. Indicamos visualmente que são dados de exemplo.
  const isEmpty =
    !!real && (real.sampleActions === 0 || real.sampleMatches === 0);
  const stats = real && !isEmpty ? real : MOCK;

  const kpis = [
    { label: "Kill %", value: stats.kpis.killPct, icon: Target, kind: "pct" },
    {
      label: "Side-Out %",
      value: stats.kpis.sideOutPct,
      icon: Shield,
      kind: "pct",
    },
    {
      label: "Pass Rating",
      value: stats.kpis.passRating,
      icon: Activity,
      kind: "num2",
    },
    {
      label: "Serve Ace %",
      value: stats.kpis.serveAcePct,
      icon: Swords,
      kind: "pct",
    },
    {
      label: "Record",
      value: stats.kpis.record,
      icon: Award,
      kind: "plain",
    },
    {
      label: "Attack Eff.",
      value: stats.kpis.attackEfficiency,
      icon: Sparkles,
      kind: "num3",
    },
  ] as const;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            Vista-resumo das últimas 6 jornadas · {team.name}
          </p>
        </div>
        {isEmpty || !real ? (
          <Badge variant="outline" className="gap-1">
            <Database className="h-3 w-3" /> Exemplo
          </Badge>
        ) : (
          <Badge variant="success" className="gap-1">
            <TrendingUp className="h-3 w-3" /> {real.sampleActions} acções
          </Badge>
        )}
      </header>

      {isEmpty && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Ainda sem acções registadas. Entra em{" "}
            <span className="font-medium">Live Scout</span> durante um jogo
            para começar a popular estes gráficos — enquanto isso mostramos
            dados de exemplo.
          </CardContent>
        </Card>
      )}

      {statsQuery.isLoading ? (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((k, idx) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {k.label}
                    </div>
                    <k.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div
                    className={cn(
                      "mt-2 font-bold tabular-nums",
                      k.kind === "plain" ? "text-2xl" : "text-2xl",
                    )}
                  >
                    {k.kind === "plain"
                      ? (k.value as string)
                      : k.kind === "pct"
                        ? formatPct(k.value as number)
                        : k.kind === "num2"
                          ? (k.value as number).toFixed(2)
                          : (k.value as number).toFixed(3)}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Tendência — últimas 6 jornadas</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <TrendChart data={stats.trend} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Perfil da equipa</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <TeamRadar data={stats.radar} />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Side-Out % por rotação</CardTitle>
          <p className="text-sm text-muted-foreground">
            Rotações a vermelho precisam de atenção; verdes são o teu ponto
            forte.
          </p>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <RotationSideOut data={stats.rotation} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

