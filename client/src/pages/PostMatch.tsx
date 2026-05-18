import { useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Download,
  Video,
  PlayCircle,
  ClipboardList,
  Radio,
  CalendarPlus,
  Tag,
  X,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTeam } from "@/hooks/useTeam";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatPct, cn } from "@/lib/utils";
import { PlanGate } from "@/components/PlanGate";
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
import {
  ACTION_TYPES,
  RESULTS_BY_ACTION,
  type ActionType,
  type ActionResult,
} from "@shared/types";

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
  const guard = usePlanGuard();
  const videoRef = useRef<VideoPanelHandle>(null);
  const qc = useQueryClient();

  // Tagged moments filters
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterPlayer, setFilterPlayer] = useState<string | null>(null);

  // Manual video tagger state
  const [taggingAt, setTaggingAt] = useState<number | null>(null);
  const [tagAction, setTagAction] = useState<ActionType | "">("");
  const [tagPlayer, setTagPlayer] = useState<string>("");
  const [tagResult, setTagResult] = useState<ActionResult | "">("");

  const tagMutation = useMutation({
    mutationFn: (body: object) => api.post(`/api/actions`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["summary", matchId] });
      toast.success("Momento marcado!");
      setTaggingAt(null);
      setTagAction("");
      setTagPlayer("");
      setTagResult("");
    },
    onError: () => toast.error("Erro ao marcar momento."),
  });

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

  async function handlePrint() {
    // Pro+ e trial têm PDFs ilimitados
    if (guard.meetsMinimum("pro")) {
      window.print();
      return;
    }
    const result = await api.post<{ allowed: boolean; used: number; limit: number }>(
      `/api/teams/${teamId}/pdf-export`, {}
    );
    if (!result.allowed) {
      toast.error(`Limite de ${result.limit} PDFs/mês atingido. Faz upgrade para Pro para PDFs ilimitados.`);
      return;
    }
    toast.info(`PDF ${result.used}/${result.limit} este mês`);
    window.print();
  }

  function exportCsv() {
    const headers = ["#", "Nome", "Pos", "Kills", "Erros", "Tentativas", "Kill%", "Eff", "Aces", "Blocks", "Digs", "Rec", "Pass", "Rating"];
    const rows = s.players.map((p) => [
      p.number,
      `${p.firstName} ${p.lastName}`,
      p.position,
      p.kills,
      p.attackErrors,
      p.attackAttempts,
      `${p.killPct}%`,
      `${p.attackEff}%`,
      p.aces,
      p.blocks,
      p.digs,
      p.receptions,
      p.passRating.toFixed(2),
      p.rating.toFixed(2),
    ]);
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell);
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(","),
      )
      .join("\n");
    const slug = s.opponent.replace(/\s+/g, "-").toLowerCase();
    const fileName = `post-match-${slug}-${matchId}.csv`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

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
            onClick={handlePrint}
            className="print-hide"
          >
            <Printer className="h-4 w-4" /> {t("postMatch.print")}
          </Button>
          <PlanGate minimumPlan="pro">
            <Button variant="outline" size="sm" className="gap-1.5 print-hide" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </PlanGate>
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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" /> {t("postMatch.videoReplay")}
                {s.taggedMoments.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {t("postMatch.taggedCount", { count: s.taggedMoments.length })}
                  </Badge>
                )}
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-xs"
                onClick={() => {
                  const t = videoRef.current?.getCurrentTime() ?? 0;
                  setTaggingAt(t);
                  setTagAction("");
                  setTagPlayer("");
                  setTagResult("");
                }}
              >
                <Tag className="h-3.5 w-3.5" /> Marcar momento
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <VideoPanel ref={videoRef} url={s.videoUrl} />

            {/* Manual tagging form */}
            {taggingAt !== null && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-primary" />
                    Marcar em <span className="font-mono text-primary">{fmtTime(taggingAt)}</span>
                  </span>
                  <button onClick={() => setTaggingAt(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Player select */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Jogador (opcional)</p>
                  <select
                    value={tagPlayer}
                    onChange={(e) => setTagPlayer(e.target.value)}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">— sem jogador —</option>
                    {s.players.map((p) => (
                      <option key={p.playerId} value={p.playerId}>
                        #{p.number} {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action type */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Tipo de ação</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ACTION_TYPES.filter((a) => a !== "freeball").map((a) => (
                      <button
                        key={a}
                        onClick={() => { setTagAction(a); setTagResult(""); }}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs transition-colors",
                          tagAction === a
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-accent",
                        )}
                      >
                        {ACTION_SHORT[a] ?? a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Result */}
                {tagAction && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Resultado</p>
                    <div className="flex flex-wrap gap-1.5">
                      {RESULTS_BY_ACTION[tagAction].map((r) => (
                        <button
                          key={r}
                          onClick={() => setTagResult(r)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs transition-colors",
                            tagResult === r
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:bg-accent",
                          )}
                        >
                          {RESULT_SHORT[r] ?? r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  disabled={!tagAction || !tagResult || tagMutation.isPending}
                  onClick={() => {
                    if (!tagAction || !tagResult) return;
                    tagMutation.mutate({
                      matchId,
                      playerId: tagPlayer || undefined,
                      type: tagAction,
                      result: tagResult,
                      videoTimeSec: Math.round(taggingAt!),
                      side: "home",
                    });
                  }}
                >
                  {tagMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> A guardar…</>
                    : <><Tag className="h-3.5 w-3.5" /> Guardar momento</>}
                </Button>
              </div>
            )}

            {/* Filters */}
            {s.taggedMoments.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground">Filtrar:</span>
                {/* Action filter chips */}
                {Array.from(new Set(s.taggedMoments.map((m) => m.type))).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterAction(filterAction === type ? null : type)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      filterAction === type
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent",
                    )}
                  >
                    {ACTION_SHORT[type] ?? type}
                  </button>
                ))}
                {/* Divider */}
                {s.taggedMoments.some((m) => m.playerName) && (
                  <span className="text-muted-foreground text-xs">·</span>
                )}
                {/* Player filter chips */}
                {Array.from(
                  new Map(
                    s.taggedMoments
                      .filter((m) => m.playerName)
                      .map((m) => [m.playerName, m.playerName])
                  ).values()
                ).map((name) => (
                  <button
                    key={name}
                    onClick={() => setFilterPlayer(filterPlayer === name ? null : name)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      filterPlayer === name
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent",
                    )}
                  >
                    {name}
                  </button>
                ))}
                {/* Clear filters */}
                {(filterAction || filterPlayer) && (
                  <button
                    onClick={() => { setFilterAction(null); setFilterPlayer(null); }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> Limpar
                  </button>
                )}
              </div>
            )}

            {/* Moments grid */}
            {(() => {
              const filtered = s.taggedMoments.filter((m) => {
                if (filterAction && m.type !== filterAction) return false;
                if (filterPlayer && m.playerName !== filterPlayer) return false;
                return true;
              });
              if (s.taggedMoments.length === 0)
                return (
                  <p className="text-sm text-muted-foreground">
                    {t("postMatch.noTaggedMoments")}
                  </p>
                );
              if (filtered.length === 0)
                return (
                  <p className="text-sm text-muted-foreground">
                    Nenhum momento para os filtros seleccionados.
                  </p>
                );
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filtered.map((m) => (
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
                            <span className="font-semibold">#{m.playerNumber} </span>
                          )}
                          {m.playerName ?? "—"}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {ACTION_SHORT[m.type] ?? m.type} · {RESULT_SHORT[m.result] ?? m.result}
                      </Badge>
                    </button>
                  ))}
                </div>
              );
            })()}
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
