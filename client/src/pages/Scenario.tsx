import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPct } from "@/lib/utils";
import type { Player } from "@shared/schema";
import { POSITIONS, type Position } from "@shared/types";

/**
 * Heuristics by position — contribution weight for each KPI.
 */
const POSITION_WEIGHTS: Record<
  Position,
  { killPct: number; sideOut: number; pass: number; block: number }
> = {
  OH: { killPct: 7, sideOut: 8, pass: 6, block: 3 },
  OPP: { killPct: 9, sideOut: 2, pass: 1, block: 4 },
  MB: { killPct: 5, sideOut: 1, pass: 0, block: 9 },
  S: { killPct: 3, sideOut: 7, pass: 3, block: 2 },
  L: { killPct: 0, sideOut: 6, pass: 10, block: 0 },
  DS: { killPct: 1, sideOut: 4, pass: 7, block: 1 },
};

const BASELINE = { killPct: 42, sideOut: 60, pass: 2.2, block: 2.4 };

function simulate(lineup: Player[]): typeof BASELINE {
  if (lineup.length === 0) return BASELINE;
  const sum = lineup.reduce(
    (acc, p) => {
      const w = POSITION_WEIGHTS[p.position];
      const tall = p.heightCm ? Math.max(0, (p.heightCm - 180) / 10) : 0;
      return {
        killPct: acc.killPct + w.killPct + tall,
        sideOut: acc.sideOut + w.sideOut,
        pass: acc.pass + w.pass,
        block: acc.block + w.block + tall,
      };
    },
    { killPct: 0, sideOut: 0, pass: 0, block: 0 },
  );
  const n = lineup.length;
  return {
    killPct: Math.min(70, 30 + (sum.killPct / n) * 0.9),
    sideOut: Math.min(85, 45 + (sum.sideOut / n) * 0.9),
    pass: Math.min(3, 1.5 + (sum.pass / n) * 0.08),
    block: Math.min(8, 1 + (sum.block / n) * 0.2),
  };
}

function aiVerdict(
  baseline: ReturnType<typeof simulate>,
  candidate: ReturnType<typeof simulate>,
): { tone: "positive" | "neutral" | "risk"; key: string } {
  const delta =
    (candidate.killPct - baseline.killPct) +
    (candidate.sideOut - baseline.sideOut) +
    (candidate.block - baseline.block) * 2;
  if (delta > 4) {
    return { tone: "positive", key: "scenario.verdictPositive" };
  }
  if (delta < -4) {
    return { tone: "risk", key: "scenario.verdictRisk" };
  }
  return { tone: "neutral", key: "scenario.verdictNeutral" };
}

export default function Scenario() {
  const { team } = useTeam();
  const { t } = useTranslation();
  const playersQuery = useQuery({
    queryKey: ["players", team?.id],
    queryFn: () => api.get<Player[]>(`/api/players?teamId=${team!.id}`),
    enabled: !!team,
  });

  const active = useMemo(
    () => (playersQuery.data ?? []).filter((p) => p.active),
    [playersQuery.data],
  );

  const initialLineup = useMemo(() => {
    const sorted = [...active].sort((a, b) => a.number - b.number);
    return sorted.slice(0, 6).map((p) => p.id);
  }, [active]);

  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const candidate = candidateIds.length ? candidateIds : initialLineup;

  const byId = useMemo(
    () => new Map(active.map((p) => [p.id, p])),
    [active],
  );
  const baseLineupPlayers = initialLineup
    .map((id) => byId.get(id))
    .filter((p): p is Player => !!p);
  const candidatePlayers = candidate
    .map((id) => byId.get(id))
    .filter((p): p is Player => !!p);

  const base = simulate(baseLineupPlayers);
  const alt = simulate(candidatePlayers);
  const verdict = aiVerdict(base, alt);

  const chartData = [
    {
      metric: "Kill %",
      actual: Number(base.killPct.toFixed(1)),
      scenario: Number(alt.killPct.toFixed(1)),
    },
    {
      metric: "Side-Out %",
      actual: Number(base.sideOut.toFixed(1)),
      scenario: Number(alt.sideOut.toFixed(1)),
    },
    {
      metric: "Pass Rating ×10",
      actual: Number((base.pass * 10).toFixed(1)),
      scenario: Number((alt.pass * 10).toFixed(1)),
    },
    {
      metric: "Blocks/set",
      actual: Number(base.block.toFixed(1)),
      scenario: Number(alt.block.toFixed(1)),
    },
  ];

  function swap(outId: string, inId: string) {
    setCandidateIds((cur) => {
      const base = cur.length ? cur : initialLineup;
      if (!base.includes(outId) || base.includes(inId)) return base;
      return base.map((id) => (id === outId ? inId : id));
    });
  }

  function reset() {
    setCandidateIds([]);
  }

  if (!team) return null;

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            {t("scenario.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("scenario.subtitle")}
          </p>
        </div>
        {candidateIds.length > 0 && (
          <Button size="sm" variant="outline" onClick={reset}>
            {t("scenario.resetLineup")}
          </Button>
        )}
      </header>

      {playersQuery.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : active.length < 7 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {t("scenario.notEnoughPlayers")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
          {/* Charts + verdict */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("scenario.actualVsScenario")}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t("scenario.projectionNote")}
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="metric"
                        fontSize={11}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        fontSize={11}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11 }}
                        iconType="circle"
                      />
                      <Bar
                        dataKey="actual"
                        name={t("scenario.actualLabel")}
                        fill="#94a3b8"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="scenario"
                        name={t("scenario.scenarioLabel")}
                        fill="hsl(var(--primary))"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                verdict.tone === "positive" && "border-emerald-500/50",
                verdict.tone === "risk" && "border-red-500/50",
              )}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg grid place-items-center shrink-0",
                    verdict.tone === "positive" &&
                      "bg-emerald-500/15 text-emerald-600",
                    verdict.tone === "neutral" && "bg-muted text-foreground",
                    verdict.tone === "risk" && "bg-red-500/15 text-red-600",
                  )}
                >
                  {verdict.tone === "positive" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : verdict.tone === "risk" ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("scenario.aiVerdict")}
                  </div>
                  <p className="text-sm">{t(verdict.key)}</p>
                  <KpiDeltas base={base} alt={alt} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pickers */}
          <aside className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> {t("scenario.currentLineup")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {candidatePlayers.map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    candidates={active.filter(
                      (x) => !candidate.includes(x.id),
                    )}
                    onSwap={(inId) => swap(p.id, inId)}
                  />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("scenario.bench")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {active
                  .filter((p) => !candidate.includes(p.id))
                  .sort((a, b) => a.number - b.number)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="font-semibold tabular-nums w-8 text-right">
                        #{p.number}
                      </span>
                      <span className="flex-1 truncate">
                        {p.firstName} {p.lastName}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {t(`players.positions.${p.position}`)}
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("scenario.positionsAvailable")}{" "}
        {POSITIONS.map((p) => t(`players.positions.${p}`)).join(" · ")}
      </p>
    </div>
  );
}

function PlayerRow({
  player,
  candidates,
  onSwap,
}: {
  player: Player;
  candidates: Player[];
  onSwap: (inId: string) => void;
}) {
  const { t } = useTranslation();
  const samePos = candidates.filter((c) => c.position === player.position);
  const pool = samePos.length ? samePos : candidates;

  return (
    <motion.div
      layout
      className="flex items-center gap-2 text-sm rounded-md border bg-card p-2"
    >
      <span className="font-semibold tabular-nums w-8 text-right">
        #{player.number}
      </span>
      <span className="flex-1 truncate">
        {player.firstName} {player.lastName}
      </span>
      <Badge variant="outline" className="text-[10px]">
        {t(`players.positions.${player.position}`)}
      </Badge>
      {pool.length > 0 && (
        <select
          className="text-xs rounded-md border bg-background px-2 py-1"
          value=""
          onChange={(e) => {
            if (e.target.value) onSwap(e.target.value);
          }}
          aria-label={t("scenario.substitutePlayer", { name: player.firstName })}
        >
          <option value="">{t("scenario.swapPrompt")}</option>
          {pool.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.number} {c.lastName} ({t(`players.positions.${c.position}`)})
            </option>
          ))}
        </select>
      )}
    </motion.div>
  );
}

function KpiDeltas({
  base,
  alt,
}: {
  base: typeof BASELINE;
  alt: typeof BASELINE;
}) {
  const rows = [
    { label: "Kill %", b: base.killPct, a: alt.killPct, pct: true },
    { label: "Side-Out %", b: base.sideOut, a: alt.sideOut, pct: true },
    { label: "Pass Rating", b: base.pass, a: alt.pass, pct: false },
    { label: "Blocks/set", b: base.block, a: alt.block, pct: false },
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {rows.map((r) => {
        const delta = r.a - r.b;
        const direction =
          Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down";
        return (
          <div
            key={r.label}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
              direction === "up" &&
                "border-emerald-500/40 text-emerald-600",
              direction === "down" && "border-red-500/40 text-red-600",
            )}
          >
            {direction === "up" && <TrendingUp className="h-3 w-3" />}
            {direction === "down" && <TrendingDown className="h-3 w-3" />}
            <span className="font-medium">{r.label}</span>
            <span className="tabular-nums">
              {r.pct ? formatPct(r.a) : r.a.toFixed(2)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              ({delta >= 0 ? "+" : ""}
              {r.pct ? `${delta.toFixed(1)}%` : delta.toFixed(2)})
            </span>
          </div>
        );
      })}
    </div>
  );
}
