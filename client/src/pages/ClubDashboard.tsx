import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Trophy,
  Users,
  Activity,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Building2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import { PlanGate } from "@/components/PlanGate";

interface TeamSummary {
  id: string;
  name: string;
  club: string;
  category: string;
  plan: string;
  primaryColor: string | null;
  matchCount: number;
  playerCount: number;
  wins: number;
  losses: number;
  lastMatchDate: string | null;
  lastMatchOpponent: string | null;
  lastMatchResult: "win" | "loss" | null;
}

export default function ClubDashboard() {
  return (
    <PlanGate minimumPlan="club">
      <ClubDashboardContent />
    </PlanGate>
  );
}

function ClubDashboardContent() {
  const { setTeam } = useTeam();

  const summaryQuery = useQuery({
    queryKey: ["club-summary"],
    queryFn: () => api.get<TeamSummary[]>("/api/club/summary"),
  });

  const teams = summaryQuery.data ?? [];
  const totalMatches = teams.reduce((s, t) => s + t.matchCount, 0);
  const totalPlayers = teams.reduce((s, t) => s + t.playerCount, 0);
  const totalWins = teams.reduce((s, t) => s + t.wins, 0);
  const totalLosses = teams.reduce((s, t) => s + t.losses, 0);
  const winRate = totalWins + totalLosses > 0
    ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
    : null;

  if (summaryQuery.isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-screen-xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          Club Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vista agregada de todas as tuas equipas · Para criar uma nova usa o switcher no topo da barra lateral.
        </p>
      </header>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Equipas",
            value: teams.length,
            icon: Building2,
            color: "text-primary",
          },
          {
            label: "Jogos totais",
            value: totalMatches,
            icon: Trophy,
            color: "text-amber-500",
          },
          {
            label: "Atletas activos",
            value: totalPlayers,
            icon: Users,
            color: "text-blue-500",
          },
          {
            label: "Win rate",
            value: winRate !== null ? `${winRate}%` : "—",
            icon: TrendingUp,
            color: "text-green-500",
          },
        ].map((kpi) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg bg-muted", kpi.color)}>
                  <kpi.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Team cards */}
      {teams.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Ainda não tens equipas</p>
          <p className="text-sm mt-1">Cria a tua primeira equipa para começar.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map((team, i) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="flex flex-col hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-8 w-8 rounded-md shrink-0"
                        style={{
                          backgroundColor: team.primaryColor ?? "hsl(var(--primary))",
                        }}
                      />
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{team.name}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">
                          {team.club} · {team.category}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 uppercase text-[10px]">
                      {team.plan}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-lg font-bold">{team.matchCount}</p>
                      <p className="text-[10px] text-muted-foreground">Jogos</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-lg font-bold">{team.playerCount}</p>
                      <p className="text-[10px] text-muted-foreground">Atletas</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-lg font-bold">
                        {team.wins}–{team.losses}
                      </p>
                      <p className="text-[10px] text-muted-foreground">V–D</p>
                    </div>
                  </div>

                  {/* Last match */}
                  {team.lastMatchOpponent && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {team.lastMatchResult === "win" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : team.lastMatchResult === "loss" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      ) : (
                        <Activity className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">
                        Último: vs {team.lastMatchOpponent}
                        {team.lastMatchDate && (
                          <> · {formatDate(new Date(team.lastMatchDate))}</>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Go to team button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      setTeam(team.id);
                      window.location.hash = "#/";
                    }}
                  >
                    Ver equipa
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
