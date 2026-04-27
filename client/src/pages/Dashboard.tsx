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
  topScorers: Array<{
    playerId: string;
    name: string;
    number: number;
    position: string;
    matches: number;
    kills: number;
    attackErrors: number;
    aces: number;
    blocks: number;
    points: number;
  }>;
  opponentBreakdown: Array<{
    opponent: string;
    matches: number;
    wins: number;
    losses: number;
    setsWon: number;
    setsLost: number;
  }>;
  rotationStats: Array<{
    rotation: number;
    totalRallies: number;
    serveRallies: number;
    serveWon: number;
    receiveRallies: number;
    receiveWon: number;
    sideOutPct: number;
    breakPointPct: number;
  }>;
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
  topScorers: [],
  opponentBreakdown: [],
  rotationStats: [],
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

      {!statsQuery.isLoading && stats.rotationStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rotações — toda a época</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sideout (recepção) e Break-point (serviço) acumulados em todos
              os jogos da equipa, não apenas os 6 mais recentes.
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Rotação</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">SO%</th>
                    <th className="px-3 py-2 text-right">BP%</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.rotationStats.map((r) => (
                    <tr key={r.rotation} className="border-t">
                      <td className="px-3 py-2 font-mono">P{r.rotation}</td>
                      <td className="px-3 py-2 text-right">
                        {r.totalRallies}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-mono",
                          r.receiveRallies === 0
                            ? "text-muted-foreground"
                            : r.sideOutPct >= 60
                              ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                              : r.sideOutPct < 40
                                ? "text-destructive"
                                : "",
                        )}
                      >
                        {r.receiveRallies ? `${r.sideOutPct}%` : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-mono",
                          r.serveRallies === 0
                            ? "text-muted-foreground"
                            : r.breakPointPct >= 35
                              ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                              : r.breakPointPct < 20
                                ? "text-destructive"
                                : "",
                        )}
                      >
                        {r.serveRallies ? `${r.breakPointPct}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {!statsQuery.isLoading && stats.topScorers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top atletas — pontos directos</CardTitle>
              <p className="text-sm text-muted-foreground">
                Soma de kills + aces + stuff blocks na época.
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Atleta</th>
                      <th className="px-3 py-2 text-right">Pts</th>
                      <th className="px-3 py-2 text-right">K</th>
                      <th className="px-3 py-2 text-right">A</th>
                      <th className="px-3 py-2 text-right">B</th>
                      <th className="px-3 py-2 text-right">Jogos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topScorers.map((t) => (
                      <tr key={t.playerId} className="border-t">
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {t.number}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium">{t.name}</span>{" "}
                          <span className="text-xs text-muted-foreground">
                            · {t.position}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">
                          {t.points}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {t.kills}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {t.aces}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {t.blocks}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {t.matches}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {!statsQuery.isLoading && stats.opponentBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Adversários — registo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Vitórias/derrotas e sets contra cada adversário (apenas
                jogos terminados).
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Adversário</th>
                      <th className="px-3 py-2 text-right">Jogos</th>
                      <th className="px-3 py-2 text-right">V-D</th>
                      <th className="px-3 py-2 text-right">Sets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.opponentBreakdown.map((o) => (
                      <tr key={o.opponent} className="border-t">
                        <td className="px-3 py-2 truncate">{o.opponent}</td>
                        <td className="px-3 py-2 text-right">{o.matches}</td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right font-mono",
                            o.wins > o.losses
                              ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                              : o.losses > o.wins
                                ? "text-destructive"
                                : "",
                          )}
                        >
                          {o.wins}-{o.losses}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {o.setsWon}-{o.setsLost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

