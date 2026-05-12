import { Link, useParams, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Clock,
  Target,
  Send,
  ShieldCheck,
  TrendingUp,
  History,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend as ReLegend,
} from "recharts";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  HeatmapCourt,
  type HeatmapZone,
} from "@/components/scout/HeatmapCourt";
import {
  ScatterCourt,
  type ScatterPoint,
} from "@/components/scout/ScatterCourt";
import type { Player } from "@shared/schema";
import type {
  TrainingFocus,
  TrainingPriority,
  TrainingRecommendation,
} from "@shared/types";

const POSITION_LABEL: Record<string, string> = {
  OH: "Ponta (Outside Hitter)",
  OPP: "Oposto (Opposite)",
  MB: "Central (Middle Blocker)",
  S: "Distribuidor (Setter)",
  L: "Líbero",
  DS: "Defensivo (Defensive Specialist)",
};

const FOCUS_LABEL: Record<TrainingFocus, string> = {
  serve: "Serviço",
  attack: "Ataque",
  reception: "Recepção",
  block: "Bloco",
  defense: "Defesa",
  setting: "Distribuição",
};

const PRIORITY_STYLE: Record<TrainingPriority, string> = {
  high: "bg-red-600 text-white hover:bg-red-600/90",
  medium: "bg-amber-500 text-white hover:bg-amber-500/90",
  low: "bg-slate-500 text-white hover:bg-slate-500/90",
};

interface PlayerHeatmap {
  type: "attack" | "serve" | "reception";
  zones: HeatmapZone[];
  total: number;
  maxCount: number;
}

interface ZoneBreakdown {
  zone: number;
  count: number;
  killPct: number;
}

interface MatchHistoryEntry {
  matchId: string;
  date: string;
  opponent: string;
  setsWon: number;
  setsLost: number;
  actions: number;
  kills: number;
  attackAttempts: number;
  killPct: number;
  attackEff: number;
  passRating: number;
  aces: number;
  blocks: number;
  digs: number;
}

interface TrendEntry {
  label: string;
  killPct: number;
  attackEff: number;
  passRating: number;
}

interface TeamKpis {
  killPct: number;
  attackEff: number;
  passRating: number;
  serveAcePct: number;
  blocks: number;
  digs: number;
}

interface PlayerSummary {
  player: Player;
  actions: number;
  kpis: {
    killPct: number;
    attackEff: number;
    passRating: number;
    serveAcePct: number;
    blocks: number;
    digs: number;
  };
  weaknesses: string[];
  attackHeatmap: PlayerHeatmap;
  serveHeatmap: PlayerHeatmap;
  receptionHeatmap: PlayerHeatmap;
  attackPoints: ScatterPoint[];
  servePoints: ScatterPoint[];
  topAttackZones: ZoneBreakdown[];
  matchHistory: MatchHistoryEntry[];
  trend: TrendEntry[];
  teamKpis: TeamKpis;
}

interface TrainingLog {
  id: string;
  playerId: string;
  priority: TrainingPriority;
  status: string;
  createdAt: string;
  rec: TrainingRecommendation;
}

export default function PlayerDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { team } = useTeam();
  const qc = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ["player-summary", team?.id, params.id],
    queryFn: () =>
      api.get<PlayerSummary>(
        `/api/players/${params.id}/summary?teamId=${team!.id}`,
      ),
    enabled: !!team && !!params.id,
  });

  const logsQuery = useQuery({
    queryKey: ["training-logs", team?.id, params.id],
    queryFn: () =>
      api.get<TrainingLog[]>(
        `/api/training/${params.id}?teamId=${team!.id}`,
      ),
    enabled: !!team && !!params.id,
  });

  const generate = useMutation({
    mutationFn: () =>
      api.post<{ recommendations: TrainingRecommendation[] }>(
        `/api/ai/training/${params.id}?teamId=${team!.id}`,
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["training-logs", team?.id, params.id],
      });
    },
  });

  if (!team) return null;

  const summary = summaryQuery.data;
  const player = summary?.player;
  const logs = logsQuery.data ?? [];

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/players")}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      {summaryQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !player ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Jogadora não encontrada.{" "}
            <Link href="/players" className="text-primary hover:underline">
              Voltar ao roster
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Header ──────────────────────────────────────────────── */}
          <Card>
            <CardContent className="p-6 flex flex-wrap items-center gap-5">
              <Avatar className="h-20 w-20 text-xl">
                <AvatarFallback>
                  {player.firstName[0]}
                  {player.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-[200px]">
                <div className="text-2xl font-bold">
                  {player.firstName} {player.lastName}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Badge variant="secondary">#{player.number}</Badge>
                  <span>{POSITION_LABEL[player.position]}</span>
                  {player.heightCm && <span>· {player.heightCm} cm</span>}
                  {!player.active && (
                    <Badge variant="outline">Inactiva</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {summary!.actions > 0
                    ? `${summary!.actions} acções nos últimos jogos`
                    : "Sem acções registadas nos últimos jogos"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Tabs ────────────────────────────────────────────────── */}
          <Tabs defaultValue="overview">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview">Visão geral</TabsTrigger>
              <TabsTrigger value="attack">Ataque</TabsTrigger>
              <TabsTrigger value="serve-reception">Serviço & Receção</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
              <TabsTrigger value="training">Treino</TabsTrigger>
            </TabsList>

            {/* ── Visão geral ─────────────────────────────────────── */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiCard
                  label="Kill %"
                  value={
                    summary!.kpis.killPct > 0
                      ? `${summary!.kpis.killPct}%`
                      : "—"
                  }
                  hint="ataques convertidos"
                  playerVal={summary!.kpis.killPct}
                  teamVal={summary!.teamKpis.killPct}
                  higherIsBetter
                />
                <KpiCard
                  label="Attack Eff"
                  value={
                    summary!.kpis.attackEff !== 0
                      ? summary!.kpis.attackEff.toFixed(3)
                      : "—"
                  }
                  hint="(kills − erros) / tentativas"
                  playerVal={summary!.kpis.attackEff}
                  teamVal={summary!.teamKpis.attackEff}
                  higherIsBetter
                />
                <KpiCard
                  label="Pass Rating"
                  value={
                    summary!.kpis.passRating > 0
                      ? summary!.kpis.passRating.toFixed(2)
                      : "—"
                  }
                  hint="escala 0–3"
                  playerVal={summary!.kpis.passRating}
                  teamVal={summary!.teamKpis.passRating}
                  higherIsBetter
                />
                <KpiCard
                  label="Serve Ace %"
                  value={
                    summary!.kpis.serveAcePct > 0
                      ? `${summary!.kpis.serveAcePct}%`
                      : "—"
                  }
                  hint="serviços directos"
                  playerVal={summary!.kpis.serveAcePct}
                  teamVal={summary!.teamKpis.serveAcePct}
                  higherIsBetter
                />
                <KpiCard
                  label="Blocks"
                  value={summary!.kpis.blocks || "—"}
                  hint="stuff blocks"
                />
                <KpiCard
                  label="Digs"
                  value={summary!.kpis.digs || "—"}
                  hint="defesas perfeitas/boas"
                />
              </div>

              {summary!.weaknesses.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Fraquezas detectadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    {summary!.weaknesses.map((w, i) => (
                      <div key={i}>· {w}</div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Trend chart — só aparece se houver ≥ 2 jogos */}
              {summary!.trend.length >= 2 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4" /> Tendência
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TrendChart data={summary!.trend} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Ataque ─────────────────────────────────────────────── */}
            <TabsContent value="attack" className="space-y-4">
              {summary!.attackHeatmap.total === 0 ? (
                <EmptySection
                  icon={<Target className="h-8 w-8" />}
                  message="Sem ataques registados nos últimos jogos."
                />
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4" />
                      Onde ataca · {summary!.attackHeatmap.total} ataques
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Distribuição por zona DV (volume) e pontos precisos
                      registados (cor = resultado).
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          Heatmap por zona
                        </div>
                        <HeatmapCourt
                          zones={summary!.attackHeatmap.zones}
                          maxCount={summary!.attackHeatmap.maxCount}
                          side="opponent"
                          ariaLabel="Heatmap de ataques por zona"
                        />
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          Pontos precisos
                        </div>
                        <ScatterCourt
                          points={summary!.attackPoints}
                          side="opponent"
                          ariaLabel="Pontos precisos de ataque"
                        />
                        <Legend />
                      </div>
                    </div>

                    {summary!.topAttackZones.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                          Top zonas favoritas
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {summary!.topAttackZones.map((z) => (
                            <div
                              key={z.zone}
                              className="rounded-md border p-2 text-center"
                            >
                              <div className="text-[10px] text-muted-foreground">
                                Z{z.zone}
                              </div>
                              <div className="text-lg font-bold tabular-nums">
                                {z.count}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {z.killPct}% kill
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Serviço & Receção ───────────────────────────────────── */}
            <TabsContent value="serve-reception" className="space-y-4">
              {/* Serve */}
              {summary!.serveHeatmap.total === 0 ? (
                <EmptySection
                  icon={<Send className="h-8 w-8" />}
                  message="Sem serviços registados nos últimos jogos."
                />
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Send className="h-4 w-4" />
                      Onde serve · {summary!.serveHeatmap.total} serviços
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Zona alvo do serviço (lado adversário).
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          Heatmap por zona
                        </div>
                        <HeatmapCourt
                          zones={summary!.serveHeatmap.zones}
                          maxCount={summary!.serveHeatmap.maxCount}
                          side="opponent"
                          ariaLabel="Heatmap de saques por zona"
                        />
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          Pontos precisos
                        </div>
                        <ScatterCourt
                          points={summary!.servePoints}
                          side="opponent"
                          ariaLabel="Pontos precisos de saque"
                        />
                        <Legend />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Reception */}
              {summary!.receptionHeatmap.total === 0 ? (
                <EmptySection
                  icon={<ShieldCheck className="h-8 w-8" />}
                  message="Sem recepções registadas nos últimos jogos."
                />
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <ShieldCheck className="h-4 w-4" />
                      Onde recebe · {summary!.receptionHeatmap.total} recepções
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Zona de destino da recepção no campo próprio.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <HeatmapCourt
                      zones={summary!.receptionHeatmap.zones}
                      maxCount={summary!.receptionHeatmap.maxCount}
                      side="ours"
                      ariaLabel="Heatmap de recepções por zona"
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Histórico ───────────────────────────────────────────── */}
            <TabsContent value="history" className="space-y-4">
              {summary!.matchHistory.length === 0 ? (
                <EmptySection
                  icon={<History className="h-8 w-8" />}
                  message="Sem jogos com dados para esta atleta."
                />
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <History className="h-4 w-4" /> Histórico jogo-a-jogo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                          <th className="text-left py-2 pr-3 font-medium">
                            Data
                          </th>
                          <th className="text-left py-2 pr-3 font-medium">
                            Adversário
                          </th>
                          <th className="text-center py-2 pr-3 font-medium">
                            Resultado
                          </th>
                          <th className="text-right py-2 pr-3 font-medium">
                            Kill%
                          </th>
                          <th className="text-right py-2 pr-3 font-medium">
                            Eff
                          </th>
                          <th className="text-right py-2 pr-3 font-medium">
                            Pass
                          </th>
                          <th className="text-right py-2 pr-3 font-medium">
                            Aces
                          </th>
                          <th className="text-right py-2 font-medium">
                            Blocks
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...summary!.matchHistory]
                          .reverse()
                          .map((m) => {
                            const won = m.setsWon > m.setsLost;
                            const lost = m.setsLost > m.setsWon;
                            return (
                              <tr
                                key={m.matchId}
                                className="border-b last:border-0 hover:bg-muted/30"
                              >
                                <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                                  {new Date(m.date).toLocaleDateString(
                                    "pt-PT",
                                    { day: "2-digit", month: "2-digit" },
                                  )}
                                </td>
                                <td className="py-2 pr-3 font-medium">
                                  {m.opponent}
                                </td>
                                <td className="py-2 pr-3 text-center">
                                  <span
                                    className={
                                      won
                                        ? "text-emerald-600 font-semibold"
                                        : lost
                                          ? "text-red-500 font-semibold"
                                          : "text-muted-foreground"
                                    }
                                  >
                                    {m.setsWon}–{m.setsLost}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums">
                                  {m.attackAttempts > 0
                                    ? `${m.killPct}%`
                                    : "—"}
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums">
                                  {m.attackAttempts > 0
                                    ? m.attackEff.toFixed(3)
                                    : "—"}
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums">
                                  {m.passRating > 0
                                    ? m.passRating.toFixed(2)
                                    : "—"}
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums">
                                  {m.aces || "—"}
                                </td>
                                <td className="py-2 text-right tabular-nums">
                                  {m.blocks || "—"}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* Trend chart in history tab too */}
              {summary!.trend.length >= 2 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4" /> Evolução ao longo dos
                      jogos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TrendChart data={summary!.trend} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Treino ─────────────────────────────────────────────── */}
            <TabsContent value="training">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Recomendações de treino
                    (IA)
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => generate.mutate()}
                    disabled={
                      generate.isPending || summary!.actions === 0
                    }
                  >
                    {generate.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> A gerar…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> Gerar recomendações
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {generate.isError && (
                    <div className="text-sm text-red-500">
                      Falha ao gerar recomendações. Tenta novamente.
                    </div>
                  )}
                  {summary!.actions === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Sem acções scouted para esta atleta — regista jogos no
                      Live Scout para desbloquear recomendações.
                    </div>
                  )}
                  {logsQuery.isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : logs.length === 0 ? (
                    summary!.actions > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Ainda não há recomendações. Clica em "Gerar
                        recomendações" para produzir um plano baseado nos KPIs
                        acima.
                      </div>
                    )
                  ) : (
                    <div className="space-y-3">
                      {logs.map((log) => (
                        <RecommendationCard key={log.id} log={log} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function EmptySection({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground border border-dashed rounded-lg">
      <div className="opacity-30">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        Positivo
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        Neutro
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        Erro / bloqueado
      </span>
    </div>
  );
}

function DeltaBadge({
  playerVal,
  teamVal,
  higherIsBetter = true,
}: {
  playerVal: number;
  teamVal: number;
  higherIsBetter?: boolean;
}) {
  if (teamVal === 0) return null;
  const diff = playerVal - teamVal;
  const threshold = teamVal * 0.05; // 5% tolerance
  if (Math.abs(diff) < threshold && Math.abs(diff) < 1) return null;

  const positive = higherIsBetter ? diff > 0 : diff < 0;
  const neutral = Math.abs(diff) < threshold;

  if (neutral) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
        média
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
        positive ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {positive ? (
        <ArrowUp className="h-2.5 w-2.5" />
      ) : (
        <ArrowDown className="h-2.5 w-2.5" />
      )}
      vs equipa
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  playerVal,
  teamVal,
  higherIsBetter,
}: {
  label: string;
  value: string | number;
  hint: string;
  playerVal?: number;
  teamVal?: number;
  higherIsBetter?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
        {playerVal !== undefined && teamVal !== undefined && (
          <div className="mt-1.5">
            <DeltaBadge
              playerVal={playerVal}
              teamVal={teamVal}
              higherIsBetter={higherIsBetter}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }: { data: TrendEntry[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={data}
        margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <ReTooltip
          contentStyle={{ fontSize: 12 }}
          formatter={(val: number, name: string) => {
            if (name === "Kill %") return [`${val}%`, name];
            if (name === "Attack Eff") return [val.toFixed(3), name];
            if (name === "Pass Rating") return [val.toFixed(2), name];
            return [val, name];
          }}
        />
        <ReLegend
          wrapperStyle={{ fontSize: 11 }}
          iconType="circle"
          iconSize={8}
        />
        <Line
          type="monotone"
          dataKey="killPct"
          name="Kill %"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="passRating"
          name="Pass Rating"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="attackEff"
          name="Attack Eff"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RecommendationCard({ log }: { log: TrainingLog }) {
  const r = log.rec;
  const totalMin = r.drills.reduce((acc, d) => acc + d.durationMin, 0);
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{r.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Foco: {FOCUS_LABEL[r.focus]} · {totalMin} min total
          </div>
        </div>
        <Badge className={PRIORITY_STYLE[r.priority]}>
          {r.priority === "high"
            ? "Alta"
            : r.priority === "medium"
              ? "Média"
              : "Baixa"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{r.rationale}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {r.drills.map((d, i) => (
          <div
            key={i}
            className="rounded-md bg-muted/50 p-3 text-sm space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{d.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {d.durationMin}m
              </div>
            </div>
            <div className="text-xs text-muted-foreground">{d.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
