import { useEffect, useMemo, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Radio, SkipForward } from "lucide-react";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { useScoutState, type LoggedAction } from "@/hooks/useScoutState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Court } from "@/components/scout/Court";
import { ActionBar } from "@/components/scout/ActionBar";
import { ResultBar } from "@/components/scout/ResultBar";
import { ScorePanel } from "@/components/scout/ScorePanel";
import { ActionLog } from "@/components/scout/ActionLog";
import type { Match, Player, Action as DbAction } from "@shared/schema";
import { ACTION_LABEL, type ActionType, type Zone } from "@shared/types";

export default function LiveScout() {
  const params = useParams<{ matchId?: string }>();
  const [, navigate] = useLocation();
  const { team } = useTeam();

  if (!team) return null;
  if (!params.matchId) return <MatchPicker teamId={team.id} />;

  return (
    <Scout
      key={params.matchId}
      matchId={params.matchId}
      teamId={team.id}
      onBack={() => navigate("/matches")}
    />
  );
}

// ── Match picker (quando /scout sem id) ──────────────────────────────────
function MatchPicker({ teamId }: { teamId: string }) {
  const matchesQuery = useQuery({
    queryKey: ["matches", teamId],
    queryFn: () => api.get<Match[]>(`/api/matches?teamId=${teamId}`),
  });
  const list = matchesQuery.data ?? [];
  const selectable = list.filter(
    (m) => m.status === "live" || m.status === "scheduled",
  );

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Live Scout
        </h1>
        <p className="text-muted-foreground text-sm">
          Escolhe um jogo para começar a registar acções.
        </p>
      </header>

      {matchesQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : selectable.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground space-y-3">
            <p>Sem jogos agendados ou em curso.</p>
            <Button asChild variant="outline">
              <Link href="/matches">Ir para Jogos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {selectable.map((m) => (
            <Link
              key={m.id}
              href={`/scout/${m.id}`}
              className="block rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">vs. {m.opponent}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.date).toLocaleDateString("pt-PT", {
                      day: "2-digit",
                      month: "short",
                    })}
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

// ── Scout propriamente dito ──────────────────────────────────────────────
function Scout({
  matchId,
  teamId,
  onBack,
}: {
  matchId: string;
  teamId: string;
  onBack: () => void;
}) {
  const [state, dispatch] = useScoutState();

  const matchQuery = useQuery({
    queryKey: ["matches", teamId],
    queryFn: () => api.get<Match[]>(`/api/matches?teamId=${teamId}`),
    select: (all) => all.find((m) => m.id === matchId) ?? null,
  });

  const playersQuery = useQuery({
    queryKey: ["players", teamId],
    queryFn: () => api.get<Player[]>(`/api/players?teamId=${teamId}`),
  });

  const actionsQuery = useQuery({
    queryKey: ["actions", matchId],
    queryFn: () =>
      api.get<DbAction[]>(`/api/matches/${matchId}/actions`),
  });

  // Hidrata o log a partir da API uma única vez.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!actionsQuery.data) return;
    const mapped: LoggedAction[] = actionsQuery.data.map((a) => ({
      id: a.id,
      playerId: a.playerId ?? "",
      type: a.type as ActionType,
      zoneTo: (a.zoneTo as Zone | null) ?? null,
      result: a.result,
      rallyId: a.rallyId ?? "",
      rotation: a.rotation ?? 1,
      setNumber: 1,
      timestamp: new Date(a.timestamp).getTime(),
    }));
    dispatch({ kind: "hydrate", actions: mapped });
    hydratedRef.current = true;
  }, [actionsQuery.data, dispatch]);

  const createAction = useMutation({
    mutationFn: (a: LoggedAction) =>
      api.post<DbAction>("/api/actions", {
        matchId,
        playerId: a.playerId,
        type: a.type,
        result: a.result,
        zoneTo: a.zoneTo,
        rallyId: a.rallyId,
        rotation: a.rotation,
      }),
    onError: (err: any) =>
      toast.error(err.message ?? "Falha a guardar acção"),
  });

  const deleteAction = useMutation({
    mutationFn: (id: string) => api.delete(`/api/actions/${id}`),
    onError: (err: any) =>
      toast.error(err.message ?? "Falha a remover acção"),
  });

  const updateMatch = useMutation({
    mutationFn: (patch: Partial<Match>) =>
      api.patch<Match>(`/api/matches/${matchId}?teamId=${teamId}`, patch),
    onError: (err: any) =>
      toast.error(err.message ?? "Falha a actualizar jogo"),
  });

  // Quando muda o step para "idle" por causa de um selectResult, persistimos
  // a última acção registada no log que ainda não tenha sido sincronizada.
  const syncedIds = useRef(new Set<string>());
  useEffect(() => {
    for (const a of state.log) {
      if (!syncedIds.current.has(a.id)) {
        syncedIds.current.add(a.id);
        createAction.mutate(a);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.log.length]);

  const activePlayers = useMemo(
    () => (playersQuery.data ?? []).filter((p) => p.active),
    [playersQuery.data],
  );

  // Lineup = as primeiras 6 activas por número (ordenação determinística).
  // Num futuro wizard de lineup isto passa a vir da tabela `lineups`.
  const lineup = useMemo<(Player | null)[]>(() => {
    const sorted = [...activePlayers].sort((a, b) => a.number - b.number);
    const slots: (Player | null)[] = [null, null, null, null, null, null];
    for (let i = 0; i < 6 && i < sorted.length; i++) slots[i] = sorted[i];
    return slots;
  }, [activePlayers]);

  const selectedPlayer = state.playerId
    ? activePlayers.find((p) => p.id === state.playerId) ?? null
    : null;

  if (matchQuery.isLoading || playersQuery.isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <Skeleton className="h-[540px] w-full" />
          <Skeleton className="h-[540px] w-full" />
        </div>
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

  const step = state.step;
  const hint =
    step === "idle" || step === "player"
      ? "Toca numa jogadora para começar."
      : step === "action"
        ? selectedPlayer
          ? `Escolhe acção para #${selectedPlayer.number} ${selectedPlayer.firstName}`
          : "Escolhe o tipo de acção."
        : step === "zone"
          ? "Escolhe a zona onde a bola caiu (ou salta o passo)."
          : "Regista o resultado da acção.";

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-3 md:space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold tracking-tight truncate">
              vs. {match.opponent}
            </h1>
            <div className="text-xs text-muted-foreground">
              {match.competition ?? "Live Scout"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {match.status !== "live" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateMatch.mutate({ status: "live" })}
              disabled={updateMatch.isPending}
            >
              <Radio className="h-4 w-4" /> Iniciar
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-3 md:gap-4">
        <div className="space-y-3">
          <ScorePanel
            homeScore={state.homeScore}
            awayScore={state.awayScore}
            setNumber={state.setNumber}
            rotation={state.rotation}
            onAdjust={(side, delta) =>
              dispatch({ kind: "adjustScore", side, delta })
            }
            onRotate={(direction) => dispatch({ kind: "rotate", direction })}
            onPrevSet={() => dispatch({ kind: "prevSet" })}
            onNextSet={() => dispatch({ kind: "nextSet" })}
          />

          <div className="rounded-xl border bg-card p-3 md:p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Campo
              </div>
              <Badge variant="outline" className="text-[10px]">
                {step === "idle"
                  ? "1 / 4 · jogadora"
                  : step === "action"
                    ? "2 / 4 · acção"
                    : step === "zone"
                      ? "3 / 4 · zona"
                      : "4 / 4 · resultado"}
              </Badge>
            </div>
            <Court
              selectedZone={state.zoneTo}
              onZoneSelect={(z) => dispatch({ kind: "selectZone", zone: z })}
              lineup={lineup}
              selectedPlayerId={state.playerId}
              onPlayerSelect={(id) =>
                dispatch({ kind: "selectPlayer", playerId: id })
              }
              rotation={state.rotation}
              zonesDisabled={step !== "zone"}
            />
            <p className="text-xs text-muted-foreground text-center mt-1">
              {hint}
            </p>
          </div>

          {/* Fluxo — aparece consoante o step actual */}
          <div className="space-y-2">
            {(step === "action" || step === "zone" || step === "result") && (
              <ActionBar
                value={state.actionType}
                onChange={(t) => dispatch({ kind: "selectAction", actionType: t })}
                disabled={step === "result"}
              />
            )}
            {step === "zone" && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dispatch({ kind: "skipZone" })}
                >
                  <SkipForward className="h-4 w-4" /> Saltar zona
                </Button>
              </div>
            )}
            {step === "result" && state.actionType && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  Resultado de {ACTION_LABEL[state.actionType].toLowerCase()}
                  {state.zoneTo ? ` em Z${state.zoneTo}` : ""}
                </div>
                <ResultBar
                  actionType={state.actionType}
                  onResult={(r) =>
                    dispatch({ kind: "selectResult", result: r })
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Log lateral */}
        <aside className="rounded-xl border bg-card p-3 md:p-4 max-h-[70vh] lg:max-h-[80vh] min-h-[280px] flex flex-col">
          <ActionLog
            log={state.log}
            players={activePlayers}
            onUndo={() => {
              const last = state.log[state.log.length - 1];
              if (!last) return;
              dispatch({ kind: "undo" });
              syncedIds.current.delete(last.id);
              deleteAction.mutate(last.id);
            }}
          />
        </aside>
      </div>
    </div>
  );
}
