import { useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Award,
  Trophy,
  TrendingUp,
  Target,
  Shield,
  Activity,
  Swords,
  Sparkles,
  ChevronRight,
  Printer,
  Video,
  PlayCircle,
  ClipboardList,
  Radio,
  CalendarPlus,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatPct, cn } from "@/lib/utils";
import { VideoPanel, type VideoPanelHandle } from "@/components/scout/VideoPanel";
import {
  HeatmapCourt,
  type HeatmapZone,
} from "@/components/scout/HeatmapCourt";
import {
  RotationTable,
  type RotationRow,
} from "@/components/scout/RotationTable";
import {
  SetterDistributionCard,
  type SetterRow,
} from "@/components/scout/SetterDistributionCard";
import type { Match } from "@shared/schema";

interface PlayerLine {
  playerId: string;
  firstName: string;
  lastName: string;
  number: number;
  position: string;
  kills: number;
  attackErrors: number;
  attackAttempts: number;
  killPct: number;
  attackEff: number;
  aces: number;
  blocks: number;
  digs: number;
  receptions: number;
  passRating: number;
  rating: number;
}

interface TaggedMoment {
  actionId: string;
  videoTimeSec: number;
  playerName: string | null;
  playerNumber: number | null;
  type: string;
  result: string;
}

interface PostMatchSummary {
  matchId: string;
  opponent: string;
  setsWon: number;
  setsLost: number;
  totalActions: number;
  videoUrl: string | null;
  teamKpis: {
    killPct: number;
    sideOutPct: number;
    passRating: number;
    serveAcePct: number;
    attackEfficiency: number;
    record: string;
  };
  players: PlayerLine[];
  highlights: Array<{ playerId: string; title: string; subtitle: string }>;
  taggedMoments: TaggedMoment[];
  rotationStats: RotationRow[];
  attackHeatmap: { zones: HeatmapZone[]; total: number; maxCount: number };
  serveHeatmap: { zones: HeatmapZone[]; total: number; maxCount: number };
  receptionHeatmap: { zones: HeatmapZone[]; total: number; maxCount: number };
  setters: SetterRow[];
}

const ACTION_SHORT: Record<string, string> = {
  serve: "Serv",
  reception: "Rec",
  set: "Dist",
  attack: "Atk",
  block: "Blk",
  dig: "Dig",
};
const RESULT_SHORT: Record<string, string> = {
  kill: "Kill",
  error: "Err",
  ace: "Ace",
  tooled: "Tooled",
  in_play: "In",
  perfect: "Perf",
  good: "Good",
  poor: "Poor",
  blocked: "Blk",
  stuff: "Stuff",
  touch: "Tch",
};

function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

export default function PostMatch() {
  const params = useParams<{ matchId?: string }>();
  const [, navigate] = useLocation();
  const { team } = useTeam();

  if (!team) return null;
  if (!params.matchId) return <MatchPicker teamId={team.id} />;
  return (
    <Summary
      key={params.matchId}
      matchId={params.matchId}
      teamId={team.id}
      onBack={() => navigate("/matches")}
    />
  );
}

function MatchPicker({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const matchesQuery = useQuery({
    queryKey: ["matches", teamId],
    queryFn: () => api.get<Match[]>(`/api/matches?teamId=${teamId}`),
  });
  const list = (matchesQuery.data ?? []).filter(
    (m) => m.status === "finished" || m.status === "live",
  );

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {t("postMatch.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("postMatch.subtitle")}
        </p>
      </header>

      {matchesQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("postMatch.empty.title")}
          description={t("postMatch.empty.description")}
          actions={
            <>
              <Button asChild>
                <Link href="/scout">
                  <Radio className="h-4 w-4" /> {t("livescout.noMatch")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/matches">
                  <CalendarPlus className="h-4 w-4" /> {t("nav.matches")}
                </Link>
              </Button>
            </>
          }
        />
      ) : (
        <div className="space-y-2">
          {list.map((m) => (
            <Link
              key={m.id}
              href={`/post-match/${m.id}`}
              className="block rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">vs. {m.opponent}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(m.date)}
                    {m.competition ? ` · ${m.competition}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-lg font-bold tabular-nums">
                    {m.setsWon}–{m.setsLost}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Summary({
  matchId,
  teamId,
  onBack,
}: {
  matchId: string;
  teamId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<VideoPanelHandle>(null);
  const summaryQuery = useQuery({
    queryKey: ["summary", matchId],
    queryFn: () =>
      api.get<PostMatchSummary>(
        `/api/matches/${matchId}/summary?teamId=${teamId}`,
      ),
    retry: false,
  });

  if (summaryQuery.isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <div className="p-4 md:p-8 max-w-screen-2xl mx-auto">
        <EmptyState
          icon={ClipboardList}
          title={t("postMatch.empty.title")}
          description={t("postMatch.empty.description")}
          actions={
            <>
              <Button asChild>
                <Link href={`/scout/${matchId}`}>
                  <Radio className="h-4 w-4" /> {t("nav.livescout")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/matches">
                  <ArrowLeft className="h-4 w-4" /> {t("nav.matches")}
                </Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const s = summaryQuery.data;
  const win = s.setsWon > s.setsLost;
  const kpis = [
    { label: "Kill %", value: formatPct(s.teamKpis.killPct), icon: Target },
    { label: "Side-Out %", value: formatPct(s.teamKpis.sideOutPct), icon: Shield },
    { label: "Pass Rating", value: s.teamKpis.passRating.toFixed(2), icon: Activity },
    { label: "Ace %", value: formatPct(s.teamKpis.serveAcePct), icon: Swords },
    { label: "Attack Eff.", value: s.teamKpis.attackEfficiency.toFixed(3), icon: Sparkles },
  ];

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="print-hide">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            vs. {s.opponent}
          </h1>
          <p className="text-muted-foreground text-sm">
            {s.totalActions} {t("common.actions")} · {s.players.length} {t("common.players")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={win ? "success" : "secondary"} className="text-base">
            {s.setsWon}–{s.setsLost} {win ? t("matches.statusLabel.won") : t("matches.statusLabel.lost")}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="print-hide"
          >
            <Printer className="h-4 w-4" /> {t("postMatch.print")}
          </Button>
        </div>
      </header>

      {/* Team KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k, idx) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 6 }}
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
                <div className="mt-2 text-2xl font-bold tabular-nums">
                  {k.value}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      {/* Highlights */}
      {s.highlights.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {s.highlights.map((h, idx) => (
            <motion.div
              key={h.playerId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card
                className={cn(
                  "relative overflow-hidden",
                  idx === 0 && "border-primary/50",
                )}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg grid place-items-center shrink-0",
                      idx === 0
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-foreground",
                    )}
                  >
                    <Award className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {idx === 0 ? "MVP" : `#${idx + 1}`}
                    </div>
                    <Link
                      href={`/players/${h.playerId}`}
                      className="font-semibold truncate block hover:underline"
                    >
                      {h.title}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate">
                      {h.subtitle}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>
      )}

      {/* Per-rotation stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> {t("postMatch.rotationStats")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("postMatch.rotationStatsNote")}
          </p>
        </CardHeader>
        <CardContent>
          <RotationTable rows={s.rotationStats} />
        </CardContent>
      </Card>

      {/* Heatmaps */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> {t("postMatch.attackHeatmap")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("postMatch.attackHeatmapNote", { count: s.attackHeatmap.total })}
            </p>
          </CardHeader>
          <CardContent>
            <HeatmapCourt
              zones={s.attackHeatmap.zones}
              maxCount={s.attackHeatmap.maxCount}
              side="opponent"
              ariaLabel={t("postMatch.attackHeatmap")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Swords className="h-4 w-4 text-primary" /> {t("postMatch.serveHeatmap")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("postMatch.serveHeatmapNote", { count: s.serveHeatmap.total })}
            </p>
          </CardHeader>
          <CardContent>
            <HeatmapCourt
              zones={s.serveHeatmap.zones}
              maxCount={s.serveHeatmap.maxCount}
              side="opponent"
              ariaLabel={t("postMatch.serveHeatmap")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> {t("postMatch.receptionHeatmap")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("postMatch.receptionHeatmapNote", { count: s.receptionHeatmap.total })}
            </p>
          </CardHeader>
          <CardContent>
            <HeatmapCourt
              zones={s.receptionHeatmap.zones}
              maxCount={s.receptionHeatmap.maxCount}
              side="ours"
              ariaLabel={t("postMatch.receptionHeatmap")}
            />
          </CardContent>
        </Card>
      </section>

      {/* Setter distribution */}
      {s.setters.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> {t("postMatch.setterDistribution")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("postMatch.setterNote")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {s.setters.map((setter) => (
              <SetterDistributionCard key={setter.setterId} setter={setter} />
            ))}
          </div>
        </section>
      )}

      {/* Video + tagged moments */}
      {s.videoUrl && (
        <Card className="print-hide">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" /> {t("postMatch.videoReplay")}
              {s.taggedMoments.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {t("postMatch.taggedCount", { count: s.taggedMoments.length })}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <VideoPanel ref={videoRef} url={s.videoUrl} />
            {s.taggedMoments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("postMatch.noTaggedMoments")}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {s.taggedMoments.map((m) => (
                  <button
                    key={m.actionId}
                    onClick={() => videoRef.current?.seekTo(m.videoTimeSec)}
                    className="text-left rounded-md border bg-card p-2 hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <PlayCircle className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground font-mono">
                        {fmtTime(m.videoTimeSec)}
                      </div>
                      <div className="text-sm truncate">
                        {m.playerNumber != null && (
                          <span className="font-semibold">
                            #{m.playerNumber}{" "}
                          </span>
                        )}
                        {m.playerName ?? "—"}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {ACTION_SHORT[m.type] ?? m.type} ·{" "}
                      {RESULT_SHORT[m.result] ?? m.result}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Player stats table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> {t("postMatch.playerStats")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {s.players.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              {t("postMatch.noPlayerActions")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2">{t("postMatch.table.player")}</th>
                    <th className="text-right py-2 px-2">{t("postMatch.table.rating")}</th>
                    <th className="text-right py-2 px-2">{t("postMatch.table.kills")}</th>
                    <th className="text-right py-2 px-2">{t("postMatch.table.errors")}</th>
                    <th className="text-right py-2 px-2">{t("postMatch.table.killPct")}</th>
                    <th className="text-right py-2 px-2">{t("postMatch.table.eff")}</th>
                    <th className="text-right py-2 px-2">{t("postMatch.table.aces")}</th>
                    <th className="text-right py-2 px-2">{t("postMatch.table.blocks")}</th>
                    <th className="text-right py-2 px-2">{t("postMatch.table.digs")}</th>
                    <th className="text-right py-2 pl-2">{t("postMatch.table.passRating")}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.players.map((p) => (
                    <tr key={p.playerId} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <Link
                          href={`/players/${p.playerId}`}
                          className="hover:underline"
                        >
                          <span className="font-semibold tabular-nums">
                            #{p.number}
                          </span>{" "}
                          {p.firstName} {p.lastName}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.position}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 font-bold tabular-nums">
                        {p.rating}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {p.kills}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {p.attackErrors}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {p.attackAttempts ? `${p.killPct}%` : "—"}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {p.attackAttempts ? p.attackEff.toFixed(3) : "—"}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {p.aces}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {p.blocks}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {p.digs}
                      </td>
                      <td className="text-right py-2 pl-2 tabular-nums">
                        {p.receptions ? p.passRating.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
