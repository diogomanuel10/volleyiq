import { Link, useParams, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Button>

      {summaryQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !player ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {t("players.notFound")}{" "}
            <Link href="/players" className="text-primary hover:underline">
              {t("players.backToRoster")}
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
                  <span>{t(`players.positionsLong.${player.position}`)}</span>
                  {player.heightCm && <span>· {player.heightCm} cm</span>}
                  {!player.active && (
                    <Badge variant="outline">{t("playerDetail.inactive")}</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {summary!.actions > 0
                    ? t("playerDetail.actions", { count: summary!.actions })
                    : t("playerDetail.noActions")}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Tabs ────────────────────────────────────────────────── */}
          <Tabs defaultValue="overview">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview">{t("playerDetail.tabs.overview")}</TabsTrigger>
              <TabsTrigger value="attack">{t("playerDetail.tabs.attack")}</TabsTrigger>
              <TabsTrigger value="serve-reception">{t("playerDetail.tabs.serveReception")}</TabsTrigger>
              <TabsTrigger value="history">{t("playerDetail.tabs.history")}</TabsTrigger>
              <TabsTrigger value="training">{t("playerDetail.tabs.training")}</TabsTrigger>
            </TabsList>

            {/* ── Overview ─────────────────────────────────────────── */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiCard
                  label={t("playerDetail.kpis.killPct")}
                  value={
                    summary!.kpis.killPct > 0
                      ? `${summary!.kpis.killPct}%`
                      : "—"
                  }
                  hint={t("playerDetail.kpis.killPctHint")}
                  playerVal={summary!.kpis.killPct}
                  teamVal={summary!.teamKpis.killPct}
                  higherIsBetter
                />
                <KpiCard
                  label={t("playerDetail.kpis.attackEff")}
                  value={
                    summary!.kpis.attackEff !== 0
                      ? summary!.kpis.attackEff.toFixed(3)
                      : "—"
                  }
                  hint={t("playerDetail.kpis.attackEffHint")}
                  playerVal={summary!.kpis.attackEff}
                  teamVal={summary!.teamKpis.attackEff}
                  higherIsBetter
                />
                <KpiCard
                  label={t("playerDetail.kpis.passRating")}
                  value={
                    summary!.kpis.passRating > 0
                      ? summary!.kpis.passRating.toFixed(2)
                      : "—"
                  }
                  hint={t("playerDetail.kpis.passRatingHint")}
                  playerVal={summary!.kpis.passRating}
                  teamVal={summary!.teamKpis.passRating}
                  higherIsBetter
                />
                <KpiCard
                  label={t("playerDetail.kpis.serveAcePct")}
                  value={
                    summary!.kpis.serveAcePct > 0
                      ? `${summary!.kpis.serveAcePct}%`
                      : "—"
                  }
                  hint={t("playerDetail.kpis.serveAcePctHint")}
                  playerVal={summary!.kpis.serveAcePct}
                  teamVal={summary!.teamKpis.serveAcePct}
                  higherIsBetter
                />
                <KpiCard
                  label={t("playerDetail.kpis.blocks")}
                  value={summary!.kpis.blocks || "—"}
                  hint={t("playerDetail.kpis.blocksHint")}
                />
                <KpiCard
                  label={t("playerDetail.kpis.digs")}
                  value={summary!.kpis.digs || "—"}
                  hint={t("playerDetail.kpis.digsHint")}
                />
              </div>

              {summary!.weaknesses.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {t("playerDetail.weaknesses")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    {summary!.weaknesses.map((w, i) => (
                      <div key={i}>· {w}</div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {summary!.trend.length >= 2 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4" /> {t("playerDetail.trend")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TrendChart data={summary!.trend} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Attack ─────────────────────────────────────────────── */}
            <TabsContent value="attack" className="space-y-4">
              {summary!.attackHeatmap.total === 0 ? (
                <EmptySection
                  icon={<Target className="h-8 w-8" />}
                  message={t("playerDetail.attackEmpty")}
                />
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4" />
                      {t("playerDetail.attackTitle", { count: summary!.attackHeatmap.total })}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t("playerDetail.attackNote")}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          {t("playerDetail.heatmapByZone")}
                        </div>
                        <HeatmapCourt
                          zones={summary!.attackHeatmap.zones}
                          maxCount={summary!.attackHeatmap.maxCount}
                          side="opponent"
                          ariaLabel={t("playerDetail.heatmapByZone")}
                        />
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          {t("playerDetail.precisePoints")}
                        </div>
                        <ScatterCourt
                          points={summary!.attackPoints}
                          side="opponent"
                          ariaLabel={t("playerDetail.precisePoints")}
                        />
                        <Legend />
                      </div>
                    </div>

                    {summary!.topAttackZones.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                          {t("playerDetail.topZones")}
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
                                {z.killPct}% {t("playerDetail.killPct")}
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

            {/* ── Serve & Reception ───────────────────────────────────── */}
            <TabsContent value="serve-reception" className="space-y-4">
              {summary!.serveHeatmap.total === 0 ? (
                <EmptySection
                  icon={<Send className="h-8 w-8" />}
                  message={t("playerDetail.serveEmpty")}
                />
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Send className="h-4 w-4" />
                      {t("playerDetail.serveTitle", { count: summary!.serveHeatmap.total })}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t("playerDetail.serveNote")}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          {t("playerDetail.heatmapByZone")}
                        </div>
                        <HeatmapCourt
                          zones={summary!.serveHeatmap.zones}
                          maxCount={summary!.serveHeatmap.maxCount}
                          side="opponent"
                          ariaLabel={t("playerDetail.heatmapByZone")}
                        />
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          {t("playerDetail.precisePoints")}
                        </div>
                        <ScatterCourt
                          points={summary!.servePoints}
                          side="opponent"
                          ariaLabel={t("playerDetail.precisePoints")}
                        />
                        <Legend />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {summary!.receptionHeatmap.total === 0 ? (
                <EmptySection
                  icon={<ShieldCheck className="h-8 w-8" />}
                  message={t("playerDetail.receptionEmpty")}
                />
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <ShieldCheck className="h-4 w-4" />
                      {t("playerDetail.receptionTitle", { count: summary!.receptionHeatmap.total })}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t("playerDetail.receptionNote")}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <HeatmapCourt
                      zones={summary!.receptionHeatmap.zones}
                      maxCount={summary!.receptionHeatmap.maxCount}
                      side="ours"
                      ariaLabel={t("playerDetail.receptionTitle", { count: summary!.receptionHeatmap.total })}
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── History ───────────────────────────────────────────── */}
            <TabsContent value="history" className="space-y-4">
              {summary!.matchHistory.length === 0 ? (
                <EmptySection
                  icon={<History className="h-8 w-8" />}
                  message={t("playerDetail.historyEmpty")}
                />
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <History className="h-4 w-4" /> {t("playerDetail.historyTitle")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                          <th className="text-left py-2 pr-3 font-medium">
                            {t("playerDetail.historyTable.date")}
                          </th>
                          <th className="text-left py-2 pr-3 font-medium">
                            {t("playerDetail.historyTable.opponent")}
                          </th>
                          <th className="text-center py-2 pr-3 font-medium">
                            {t("playerDetail.historyTable.result")}
                          </th>
                          <th className="text-right py-2 pr-3 font-medium">
                            {t("playerDetail.historyTable.killPct")}
                          </th>
                          <th className="text-right py-2 pr-3 font-medium">
                            {t("playerDetail.historyTable.eff")}
                          </th>
                          <th className="text-right py-2 pr-3 font-medium">
                            {t("playerDetail.historyTable.pass")}
                          </th>
                          <th className="text-right py-2 pr-3 font-medium">
                            {t("playerDetail.historyTable.aces")}
                          </th>
                          <th className="text-right py-2 font-medium">
                            {t("playerDetail.historyTable.blocks")}
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
                                    undefined,
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

              {summary!.trend.length >= 2 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4" /> {t("playerDetail.trendEvolution")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TrendChart data={summary!.trend} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Training ─────────────────────────────────────────────── */}
            <TabsContent value="training">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> {t("playerDetail.trainingTitle")}
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
                        <Loader2 className="h-4 w-4 animate-spin" /> {t("playerDetail.generating")}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> {t("playerDetail.generateRecs")}
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {generate.isError && (
                    <div className="text-sm text-red-500">
                      {t("playerDetail.generateError")}
                    </div>
                  )}
                  {summary!.actions === 0 && (
                    <div className="text-sm text-muted-foreground">
                      {t("playerDetail.noActionsForTraining")}
                    </div>
                  )}
                  {logsQuery.isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : logs.length === 0 ? (
                    summary!.actions > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {t("playerDetail.noRecs")}
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        {t("playerDetail.legend.positive")}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        {t("playerDetail.legend.neutral")}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        {t("playerDetail.legend.errorBlocked")}
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
  const { t } = useTranslation();
  if (teamVal === 0) return null;
  const diff = playerVal - teamVal;
  const threshold = teamVal * 0.05;
  if (Math.abs(diff) < threshold && Math.abs(diff) < 1) return null;

  const positive = higherIsBetter ? diff > 0 : diff < 0;
  const neutral = Math.abs(diff) < threshold;

  if (neutral) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
        {t("playerDetail.avg")}
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
      {t("playerDetail.vsTeam")}
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
  const { t } = useTranslation();
  const r = log.rec;
  const totalMin = r.drills.reduce((acc, d) => acc + d.durationMin, 0);
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{r.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {t("playerDetail.focusLabel", { focus: t(`playerDetail.trainingFocus.${r.focus}`), min: totalMin })}
          </div>
        </div>
        <Badge className={PRIORITY_STYLE[r.priority]}>
          {t(`playerDetail.priority.${r.priority}`)}
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
