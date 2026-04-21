import { useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardList,
  Radio,
  FileBarChart,
  Users,
  Eye,
  Swords,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatDate, cn } from "@/lib/utils";
import {
  CHECKLIST_CATEGORIES,
  type ChecklistCategory,
} from "@shared/types";
import type { ChecklistItem, Match } from "@shared/schema";

const CATEGORY_META: Record<
  ChecklistCategory,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  lineup: { label: "Lineup", icon: Users },
  scouting: { label: "Scouting", icon: Eye },
  tactical: { label: "Tático", icon: Swords },
  logistics: { label: "Logística", icon: Truck },
};

export default function MatchDay() {
  const params = useParams<{ matchId?: string }>();
  const [, navigate] = useLocation();
  const { team } = useTeam();

  if (!team) return null;
  if (!params.matchId) return <MatchPicker teamId={team.id} />;

  return (
    <Board
      key={params.matchId}
      matchId={params.matchId}
      teamId={team.id}
      onBack={() => navigate("/matches")}
    />
  );
}

function MatchPicker({ teamId }: { teamId: string }) {
  const matchesQuery = useQuery({
    queryKey: ["matches", teamId],
    queryFn: () => api.get<Match[]>(`/api/matches?teamId=${teamId}`),
  });
  const list = (matchesQuery.data ?? []).filter(
    (m) => m.status === "scheduled" || m.status === "live",
  );

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Match Day
        </h1>
        <p className="text-muted-foreground text-sm">
          Escolhe o próximo jogo para preparares a checklist.
        </p>
      </header>

      {matchesQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground space-y-3">
            <p>Sem jogos agendados.</p>
            <Button asChild variant="outline">
              <Link href="/matches">Ir para Jogos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((m) => (
            <Link
              key={m.id}
              href={`/matchday/${m.id}`}
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
                <Badge variant={m.status === "live" ? "warning" : "secondary"}>
                  {m.status === "live" ? "Live" : "Agendado"}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Board({
  matchId,
  teamId,
  onBack,
}: {
  matchId: string;
  teamId: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();

  const matchQuery = useQuery({
    queryKey: ["matches", teamId],
    queryFn: () => api.get<Match[]>(`/api/matches?teamId=${teamId}`),
    select: (all) => all.find((m) => m.id === matchId) ?? null,
  });

  const checklistQuery = useQuery({
    queryKey: ["checklist", matchId],
    queryFn: () =>
      api.get<ChecklistItem[]>(`/api/matches/${matchId}/checklist`),
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; done: boolean }) =>
      api.patch(`/api/checklist/${vars.id}`, { done: vars.done }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["checklist", matchId] });
      const prev = qc.getQueryData<ChecklistItem[]>(["checklist", matchId]);
      qc.setQueryData<ChecklistItem[]>(["checklist", matchId], (old) =>
        (old ?? []).map((it) =>
          it.id === vars.id ? { ...it, done: vars.done } : it,
        ),
      );
      return { prev };
    },
    onError: (err: any, _vars, ctx) => {
      qc.setQueryData(["checklist", matchId], ctx?.prev);
      toast.error(err.message ?? "Falha a gravar");
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: ["checklist", matchId] }),
  });

  const items = checklistQuery.data ?? [];
  const grouped = useMemo(() => {
    const map: Record<ChecklistCategory, ChecklistItem[]> = {
      lineup: [],
      scouting: [],
      tactical: [],
      logistics: [],
    };
    for (const it of items) map[it.category as ChecklistCategory].push(it);
    return map;
  }, [items]);

  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  if (matchQuery.isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const match = matchQuery.data;
  if (!match) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Jogo não encontrado.{" "}
            <Link href="/matches" className="text-primary hover:underline">
              Voltar aos jogos
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            vs. {match.opponent}
          </h1>
          <p className="text-muted-foreground text-sm">
            {formatDate(match.date)}
            {match.venue === "home"
              ? " · Casa"
              : match.venue === "away"
                ? " · Fora"
                : " · Neutro"}
            {match.competition ? ` · ${match.competition}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/scout/${match.id}`}>
              <Radio className="h-4 w-4" /> Live Scout
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/reports/${encodeURIComponent(match.opponent)}`}
            >
              <FileBarChart className="h-4 w-4" /> Report
            </Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Readiness
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {done}/{total}
              </div>
            </div>
            <Badge
              variant={
                pct === 100 ? "success" : pct >= 60 ? "warning" : "secondary"
              }
              className="gap-1"
            >
              {pct === 100 && <CheckCircle2 className="h-3 w-3" />}
              {pct}%
            </Badge>
          </div>
          <Progress
            value={pct}
            className={cn(
              pct === 100 && "[&>div]:bg-emerald-600",
              pct < 60 && "[&>div]:bg-amber-500",
            )}
          />
        </CardContent>
      </Card>

      {checklistQuery.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CHECKLIST_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const rows = grouped[cat] ?? [];
            const d = rows.filter((r) => r.done).length;
            return (
              <Card key={cat}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold">
                      <meta.icon className="h-4 w-4 text-primary" />
                      {meta.label}
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {d}/{rows.length}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {rows.map((it) => (
                      <motion.li
                        key={it.id}
                        layout
                        className="flex items-start gap-2"
                      >
                        <label className="flex items-start gap-2 cursor-pointer w-full">
                          <input
                            type="checkbox"
                            checked={it.done}
                            onChange={(e) =>
                              toggleMutation.mutate({
                                id: it.id,
                                done: e.target.checked,
                              })
                            }
                            className="mt-1 h-4 w-4 rounded border-input"
                          />
                          <span
                            className={cn(
                              "text-sm flex-1",
                              it.done &&
                                "text-muted-foreground line-through",
                            )}
                          >
                            {it.label}
                          </span>
                        </label>
                      </motion.li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
