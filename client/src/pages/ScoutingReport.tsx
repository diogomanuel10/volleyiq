import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Sparkles,
  FileBarChart,
  TrendingUp,
  Send,
  Target,
  RotateCw,
  User,
  Hand,
} from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Match } from "@shared/schema";
import type { DetectedPattern, PatternDetectionInput } from "@shared/types";

interface ScoutingAggregation {
  opponent: string;
  sampleMatches: number;
  matchIds: string[];
  input: PatternDetectionInput;
  serveZones: Array<{ zone: string; count: number }>;
  attackZones: Array<{ zone: string; count: number }>;
  rotationSideOut: Array<{ rotation: string; pct: number }>;
}

const CATEGORY_META: Record<
  DetectedPattern["category"],
  { label: string; icon: React.ComponentType<{ className?: string }>; tint: string }
> = {
  serve: { label: "Serviço", icon: Send, tint: "bg-sky-500" },
  attack: { label: "Ataque", icon: Target, tint: "bg-emerald-500" },
  rotation: { label: "Rotação", icon: RotateCw, tint: "bg-amber-500" },
  setter: { label: "Distribuidor", icon: Hand, tint: "bg-purple-500" },
  reception: { label: "Recepção", icon: User, tint: "bg-rose-500" },
};

export default function ScoutingReport() {
  const params = useParams<{ opponent?: string }>();
  const [, navigate] = useLocation();
  const { team } = useTeam();

  if (!team) return null;
  if (!params.opponent) return <OpponentPicker teamId={team.id} />;
  return (
    <Report
      key={params.opponent}
      opponent={decodeURIComponent(params.opponent)}
      teamId={team.id}
      onBack={() => navigate("/matches")}
    />
  );
}

function OpponentPicker({ teamId }: { teamId: string }) {
  const matchesQuery = useQuery({
    queryKey: ["matches", teamId],
    queryFn: () => api.get<Match[]>(`/api/matches?teamId=${teamId}`),
  });

  const opponents = useMemo(() => {
    const all = matchesQuery.data ?? [];
    const map = new Map<string, { opponent: string; count: number; last: Date }>();
    for (const m of all) {
      const existing = map.get(m.opponent);
      const d = new Date(m.date);
      if (existing) {
        existing.count++;
        if (d > existing.last) existing.last = d;
      } else {
        map.set(m.opponent, { opponent: m.opponent, count: 1, last: d });
      }
    }
    return [...map.values()].sort((a, b) => b.last.getTime() - a.last.getTime());
  }, [matchesQuery.data]);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Scouting Reports
        </h1>
        <p className="text-muted-foreground text-sm">
          Escolhe um adversário para gerar o relatório com padrões detectados pela IA.
        </p>
      </header>

      {matchesQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : opponents.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground space-y-3">
            <p>Ainda sem adversários. Regista jogos primeiro.</p>
            <Button asChild variant="outline">
              <Link href="/matches">Ir para Jogos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {opponents.map((o) => (
            <Link
              key={o.opponent}
              href={`/reports/${encodeURIComponent(o.opponent)}`}
              className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-semibold truncate">{o.opponent}</div>
                <div className="text-xs text-muted-foreground">
                  {o.count} jogo(s) · último em{" "}
                  {o.last.toLocaleDateString("pt-PT", {
                    day: "2-digit",
                    month: "short",
                  })}
                </div>
              </div>
              <FileBarChart className="h-5 w-5 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Report({
  opponent,
  teamId,
  onBack,
}: {
  opponent: string;
  teamId: string;
  onBack: () => void;
}) {
  const reportQuery = useQuery({
    queryKey: ["scouting", teamId, opponent],
    queryFn: () =>
      api.get<ScoutingAggregation>(
        `/api/scouting/${encodeURIComponent(opponent)}?teamId=${teamId}`,
      ),
    retry: false,
  });

  const [patterns, setPatterns] = useState<DetectedPattern[] | null>(null);
  const patternsMutation = useMutation({
    mutationFn: (input: PatternDetectionInput) =>
      api.post<{ patterns: DetectedPattern[] }>("/api/ai/patterns", input),
    onSuccess: (data) => setPatterns(data.patterns),
  });

  // Dispara detecção automaticamente assim que os dados agregados chegam —
  // assim o treinador não tem de carregar num botão para ver o relatório.
  useEffect(() => {
    if (!reportQuery.data) return;
    if (patterns) return;
    patternsMutation.mutate(reportQuery.data.input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportQuery.data?.opponent]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-primary" />
            {opponent}
          </h1>
          <p className="text-muted-foreground text-sm">
            Relatório baseado em todas as acções registadas contra este adversário.
          </p>
        </div>
        {reportQuery.data && (
          <Badge variant="secondary" className="gap-1">
            <TrendingUp className="h-3 w-3" />
            {reportQuery.data.sampleMatches} jogo(s) ·{" "}
            {reportQuery.data.input.sampleSize} acções
          </Badge>
        )}
      </header>

      {reportQuery.isLoading ? (
        <Skeleton className="h-60 w-full" />
      ) : reportQuery.isError || !reportQuery.data ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground space-y-2">
            <p>Sem dados registados para {opponent}.</p>
            <p className="text-xs">
              Faz Live Scout num jogo contra esta equipa para popular o relatório.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* AI patterns */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Padrões detectados
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  patternsMutation.mutate(reportQuery.data.input)
                }
                disabled={patternsMutation.isPending}
              >
                {patternsMutation.isPending ? "A analisar…" : "Reanalisar"}
              </Button>
            </div>

            {patternsMutation.isPending && !patterns ? (
              <div className="grid md:grid-cols-2 gap-3">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : patterns?.length ? (
              <div className="grid md:grid-cols-2 gap-3">
                {patterns.map((p, idx) => {
                  const meta = CATEGORY_META[p.category];
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                    >
                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`h-9 w-9 rounded-lg ${meta.tint} text-white grid place-items-center shrink-0`}
                            >
                              <meta.icon className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px]">
                                  {meta.label}
                                </Badge>
                                <span className="text-xs tabular-nums font-medium">
                                  {p.confidence}%
                                </span>
                              </div>
                              <div className="font-semibold mt-1">{p.title}</div>
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                            <div
                              className={`h-full ${meta.tint}`}
                              style={{ width: `${p.confidence}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              Evidência:
                            </span>{" "}
                            {p.evidence}
                          </p>
                          <p className="text-xs">
                            <span className="font-semibold">Recomendação:</span>{" "}
                            {p.recommendation}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  Sem padrões para este adversário. Adiciona mais acções e tenta
                  reanalisar.
                </CardContent>
              </Card>
            )}
          </section>

          {/* Charts */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Zonas de serviço</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Para onde o adversário costuma servir.
                </p>
              </CardHeader>
              <CardContent>
                <ZoneBarChart data={reportQuery.data.serveZones} color="#0284c7" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Zonas de ataque</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Destinos de ataque observados.
                </p>
              </CardHeader>
              <CardContent>
                <ZoneBarChart data={reportQuery.data.attackZones} color="#059669" />
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Side-Out % por rotação</CardTitle>
              <p className="text-xs text-muted-foreground">
                Rotações em que o adversário é mais vulnerável.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reportQuery.data.rotationSideOut}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="rotation"
                      fontSize={11}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      fontSize={11}
                      stroke="hsl(var(--muted-foreground))"
                      unit="%"
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="pct" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ZoneBarChart({
  data,
  color,
}: {
  data: Array<{ zone: string; count: number }>;
  color: string;
}) {
  if (!data.length) {
    return (
      <div className="h-56 grid place-items-center text-xs text-muted-foreground">
        Sem dados.
      </div>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="zone"
            fontSize={11}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
