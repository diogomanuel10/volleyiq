import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Crown,
  Monitor,
  Radio,
  Repeat,
  SkipForward,
  Users,
  Video,
  Zap,
  Gauge,
} from "lucide-react";
import { useTeam } from "@/hooks/useTeam";
import { useScoutKeyboard } from "@/hooks/useScoutKeyboard";
import { api } from "@/lib/api";
import {
  deriveSuggestion,
  useScoutState,
  type LoggedAction,
} from "@/hooks/useScoutState";
import { useScoutMode, type ScoutMode } from "@/lib/scoutMode";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Court } from "@/components/scout/Court";
import { ActionBar } from "@/components/scout/ActionBar";
import { ResultBar } from "@/components/scout/ResultBar";
import { ScorePanel } from "@/components/scout/ScorePanel";
import { ActionLog } from "@/components/scout/ActionLog";
import { VideoPanel, type VideoPanelHandle } from "@/components/scout/VideoPanel";
import type {
  Match,
  Player,
  Action as DbAction,
  Team,
  Lineup,
  Substitution,
} from "@shared/schema";
import { ACTION_LABEL, type ActionType, type Zone } from "@shared/types";
import { LineupWizard } from "@/components/scout/LineupWizard";
import { SubstitutionDialog } from "@/components/scout/SubstitutionDialog";

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
      team={team}
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
  team,
  onBack,
}: {
  matchId: string;
  team: Team;
  onBack: () => void;
}) {
  const teamId = team.id;
  const { mode, canUseComplete, set: setMode } = useScoutMode(
    teamId,
    team.plan,
  );
const [state, dispatch] = useScoutState(mode);

useScoutKeyboard(state, dispatch);
  
  // Side em que o utilizador clicou (não persiste; só para desenhar a seta).
  const [zoneFromSide, setZoneFromSide] = useState<"opponent" | "ours" | null>(
    null,
  );
  const [zoneToSide, setZoneToSide] = useState<"opponent" | "ours" | null>(
    null,
  );

  // Sincroniza o reducer com a preferência guardada quando esta muda.
  useEffect(() => {
    dispatch({ kind: "setMode", mode });
    setZoneFromSide(null);
    setZoneToSide(null);
  }, [mode, dispatch]);

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
      zoneFrom: (a.zoneFrom as Zone | null) ?? null,
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

  const videoRef = useRef<VideoPanelHandle>(null);

  const createAction = useMutation({
    mutationFn: (a: LoggedAction) =>
      api.post<DbAction>("/api/actions", {
        matchId,
        playerId: a.playerId,
        type: a.type,
        result: a.result,
        zoneFrom: a.zoneFrom,
        zoneTo: a.zoneTo,
        rallyId: a.rallyId,
        rotation: a.rotation,
        videoTimeSec: videoRef.current?.getCurrentTime() ?? null,
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

  const lineupsQuery = useQuery({
    queryKey: ["lineups", matchId],
    queryFn: () => api.get<Lineup[]>(`/api/matches/${matchId}/lineups`),
  });
  const subsQuery = useQuery({
    queryKey: ["substitutions", matchId],
    queryFn: () =>
      api.get<Substitution[]>(`/api/matches/${matchId}/substitutions`),
  });
  const [lineupOpen, setLineupOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);

  const savedLineup = useMemo(
    () =>
      (lineupsQuery.data ?? []).find((l) => l.setNumber === state.setNumber) ??
      null,
    [lineupsQuery.data, state.setNumber],
  );

  /**
   * Lineup = se tivermos lineup guardado para este set, partimos dele e
   * aplicamos as substituições por ordem de timestamp. Caso contrário,
   * fallback para "primeiras 6 activas por número" (comportamento legacy).
   */
  const lineup = useMemo<(Player | null)[]>(() => {
    const byId = new Map(activePlayers.map((p) => [p.id, p]));
    if (savedLineup) {
      const slots: (Player | null)[] = [
        savedLineup.p1 ? byId.get(savedLineup.p1) ?? null : null,
        savedLineup.p2 ? byId.get(savedLineup.p2) ?? null : null,
        savedLineup.p3 ? byId.get(savedLineup.p3) ?? null : null,
        savedLineup.p4 ? byId.get(savedLineup.p4) ?? null : null,
        savedLineup.p5 ? byId.get(savedLineup.p5) ?? null : null,
        savedLineup.p6 ? byId.get(savedLineup.p6) ?? null : null,
      ];
      // Aplica substituições por ordem cronológica.
      const subsForSet = (subsQuery.data ?? [])
        .filter((s) => s.setNumber === state.setNumber)
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() -
            new Date(b.timestamp).getTime(),
        );
      for (const sub of subsForSet) {
        const idx = slots.findIndex((p) => p?.id === sub.playerOutId);
        if (idx === -1) continue;
        slots[idx] = byId.get(sub.playerInId) ?? null;
      }
      return slots;
    }
    const sorted = [...activePlayers].sort((a, b) => a.number - b.number);
    const slots: (Player | null)[] = [null, null, null, null, null, null];
    for (let i = 0; i < 6 && i < sorted.length; i++) slots[i] = sorted[i];
    return slots;
  }, [activePlayers, savedLineup, subsQuery.data, state.setNumber]);

  // Quem está em campo agora (jogadoras únicas no `lineup` 6-slot) e quem
  // está no banco (toda a roster activa que não está em campo).
  const onCourt = useMemo<Player[]>(() => {
    const seen = new Set<string>();
    const out: Player[] = [];
    for (const p of lineup) {
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
    }
    return out;
  }, [lineup]);
  const bench = useMemo<Player[]>(() => {
    const onIds = new Set(onCourt.map((p) => p.id));
    return activePlayers.filter((p) => !onIds.has(p.id));
  }, [activePlayers, onCourt]);

  const selectedPlayer = state.playerId
    ? activePlayers.find((p) => p.id === state.playerId) ?? null
    : null;

  // Hooks devem ficar TODOS antes de qualquer early-return condicional —
  // por isso `useMemo` da sugestão fica aqui em cima.
  const suggested = useMemo(() => deriveSuggestion(state.log), [state.log]);

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

  const totalSteps = mode === "complete" ? 5 : 4;
  const stepNumber =
    step === "idle" || step === "player"
      ? 1
      : step === "action"
        ? 2
        : step === "zoneFrom"
          ? 3
          : step === "zone" || step === "zoneTo"
            ? mode === "complete"
              ? 4
              : 3
            : mode === "complete"
              ? 5
              : 4;
  const stepLabel =
    step === "idle" || step === "player"
      ? "jogadora"
      : step === "action"
        ? "acção"
        : step === "zoneFrom"
          ? "origem"
          : step === "zone" || step === "zoneTo"
            ? mode === "complete"
              ? "destino"
              : "zona"
            : "resultado";

  const hint =
    step === "idle" || step === "player"
      ? "Toca numa jogadora para começar."
      : step === "action"
        ? selectedPlayer
          ? `Escolhe acção para #${selectedPlayer.number} ${selectedPlayer.firstName}`
          : "Escolhe o tipo de acção."
        : step === "zoneFrom"
          ? "Toca onde a bola foi contactada (origem)."
          : step === "zoneTo"
            ? "Toca onde a bola caiu / chegou (destino)."
            : step === "zone"
              ? "Escolhe a zona onde a bola caiu (ou salta o passo)."
              : "Regista o resultado da acção.";

  function handleZoneFromSelect(zone: Zone, side: "opponent" | "ours") {
    setZoneFromSide(side);
    dispatch({ kind: "selectZoneFrom", zone });
  }
  function handleZoneToSelect(zone: Zone, side: "opponent" | "ours") {
    setZoneToSide(side);
    if (mode === "complete") dispatch({ kind: "selectZoneTo", zone });
    else dispatch({ kind: "selectZone", zone });
  }
  function handleModeChange(next: ScoutMode) {
    if (next === "complete" && !canUseComplete) {
      toast.message("Modo Completo requer plano Pro ou Club", {
        description: "Vê os planos em /pricing.",
        action: {
          label: "Ver planos",
          onClick: () => (window.location.hash = "/pricing"),
        },
      });
      return;
    }
    setMode(next);
  }

  return (
    <div className="p-3 md:p-6 mx-auto space-y-3 md:space-y-4">
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
          <ModeSwitch
            mode={mode}
            canUseComplete={canUseComplete}
            onChange={handleModeChange}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLineupOpen(true)}
            title="Definir lineup deste set"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">
              {savedLineup ? "Lineup" : "Definir lineup"}
            </span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSubOpen(true)}
            disabled={onCourt.length === 0 || bench.length === 0}
            title="Substituição"
          >
            <Repeat className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Subs</span>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/second-screen/${matchId}`}>
              <Monitor className="h-4 w-4" /> Segunda écran
            </Link>
          </Button>
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
                {stepNumber} / {totalSteps} · {stepLabel}
              </Badge>
            </div>
            <Court
              selectedZone={state.zoneTo}
              selectedZoneFrom={state.zoneFrom}
              selectedZoneSide={zoneToSide}
              selectedZoneFromSide={zoneFromSide}
              pickTarget={
                step === "zoneFrom"
                  ? "from"
                  : step === "zoneTo" || step === "zone"
                    ? "to"
                    : null
              }
              onZoneSelect={handleZoneToSelect}
              onZoneFromSelect={handleZoneFromSelect}
              lineup={lineup}
              selectedPlayerId={state.playerId}
              onPlayerSelect={(id) =>
                dispatch({ kind: "selectPlayer", playerId: id })
              }
              rotation={state.rotation}
              playersDisabled={
                step !== "idle" && step !== "player"
              }
              zonesDisabled={
                step !== "zone" && step !== "zoneFrom" && step !== "zoneTo"
              }
            />
            <p className="text-xs text-muted-foreground text-center mt-1">
              {hint}
            </p>
          </div>

          {/* Fluxo — aparece consoante o step actual */}
          <div className="space-y-2">
            {(step === "action" ||
              step === "zone" ||
              step === "zoneFrom" ||
              step === "zoneTo" ||
              step === "result") && (
              <ActionBar
                value={state.actionType}
                onChange={(t) =>
                  dispatch({ kind: "selectAction", actionType: t })
                }
                disabled={step === "result"}
                suggested={
                  step === "action" && mode === "complete" ? suggested : null
                }
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
                  {state.zoneFrom != null
                    ? ` (Z${state.zoneFrom} → Z${state.zoneTo})`
                    : state.zoneTo != null
                      ? ` em Z${state.zoneTo}`
                      : ""}
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

        {/* Log lateral + vídeo (opcional) */}
        <aside className="space-y-3 min-w-0">
          {match.videoUrl && (
            <div className="rounded-xl border bg-card p-3 md:p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Video className="h-3.5 w-3.5" /> Vídeo
              </div>
              <VideoPanel ref={videoRef} url={match.videoUrl} />
              <p className="text-[11px] text-muted-foreground">
                As acções registadas vão ser marcadas com o tempo actual do
                vídeo.
              </p>
            </div>
          )}
          <div className="rounded-xl border bg-card p-3 md:p-4 max-h-[60vh] lg:max-h-[70vh] min-h-[280px] flex flex-col">
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
          </div>
        </aside>
      </div>

      <LineupWizard
        open={lineupOpen}
        onOpenChange={setLineupOpen}
        matchId={matchId}
        setNumber={state.setNumber}
        rotation={state.rotation}
        roster={activePlayers}
        existing={savedLineup}
        onSaved={() => {
          lineupsQuery.refetch();
        }}
      />

      <SubstitutionDialog
        open={subOpen}
        onOpenChange={setSubOpen}
        matchId={matchId}
        setNumber={state.setNumber}
        homeScore={state.homeScore}
        awayScore={state.awayScore}
        onCourt={onCourt}
        bench={bench}
        onCreated={() => {
          subsQuery.refetch();
        }}
      />
    </div>
  );
}

// ── Mode switch (Lite vs Completo) ───────────────────────────────────────
function ModeSwitch({
  mode,
  canUseComplete,
  onChange,
}: {
  mode: ScoutMode;
  canUseComplete: boolean;
  onChange: (m: ScoutMode) => void;
}) {
  const Btn = ({
    target,
    icon: Icon,
    label,
  }: {
    target: ScoutMode;
    icon: typeof Zap;
    label: string;
  }) => {
    const active = mode === target;
    const locked = target === "complete" && !canUseComplete;
    return (
      <button
        onClick={() => onChange(target)}
        title={
          locked
            ? "Plano Pro/Club desbloqueia o modo Completo"
            : `Modo ${label}`
        }
        className={cn(
          "inline-flex items-center gap-1 px-2.5 h-8 text-xs font-medium transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : locked
              ? "text-muted-foreground"
              : "hover:bg-accent",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        {locked && <Crown className="h-3 w-3 opacity-70" />}
      </button>
    );
  };

  return (
    <div className="hidden sm:inline-flex items-stretch rounded-md border overflow-hidden">
      <Btn target="lite" icon={Zap} label="Lite" />
      <div className="w-px bg-border" aria-hidden />
      <Btn target="complete" icon={Gauge} label="Completo" />
    </div>
  );
}
