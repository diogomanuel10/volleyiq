import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Crown,
  Keyboard,
  Loader2,
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
  deriveNextSide,
  useScoutState,
  type LoggedAction,
  type Side,
} from "@/hooks/useScoutState";
import { useScoutMode, type ScoutMode } from "@/lib/scoutMode";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Court, type CourtPoint } from "@/components/scout/Court";
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
  OpponentPlayer,
} from "@shared/schema";
import { ACTION_LABEL, type ActionType, type Zone, type ScoutScope } from "@shared/types";
import { LineupWizard } from "@/components/scout/LineupWizard";
import { SubstitutionDialog } from "@/components/scout/SubstitutionDialog";
import {
  KeyboardHelp,
  type ScoutHelpTab,
} from "@/components/scout/KeyboardHelp";
import { WelcomeBanner } from "@/components/scout/WelcomeBanner";
import { LastActionPill } from "@/components/scout/LastActionPill";
import { StepProgress } from "@/components/scout/StepProgress";
import { SuggestionsPanel } from "@/components/scout/SuggestionsPanel";
import {
  buildSuggestions,
  type ScoutingHistory,
} from "@/lib/suggestions";
import { getEffectiveLineup } from "@/lib/libero";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const WELCOME_KEY = "volleyiq:scout:welcomed";

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<ScoutHelpTab>("shortcuts");
  const [welcomeDismissed, setWelcomeDismissed] = useState(true);

  // Banner de primeira visita: aparece se não estiver na flag local. Lemos
  // de forma lazy para evitar acessos a window durante SSR/hidratação.
  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(WELCOME_KEY);
      if (!seen) setWelcomeDismissed(false);
    } catch {
      // localStorage indisponível (modo privado etc.) — banner fica oculto.
    }
  }, []);

  const dismissWelcome = () => {
    setWelcomeDismissed(true);
    try {
      window.localStorage.setItem(WELCOME_KEY, "1");
    } catch {
      // ignora
    }
  };

  const openHelp = (tab: ScoutHelpTab = "shortcuts") => {
    setHelpTab(tab);
    setHelpOpen(true);
  };

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

  // Após registar o resultado, o reducer limpa zoneFrom/zoneTo e volta a
  // "idle" — alinhamos os sides locais (que vivem fora do reducer) para o
  // dot/seta desaparecerem com a animação de exit.
  useEffect(() => {
    if (state.step === "idle" && state.zoneFrom == null && state.zoneTo == null) {
      setZoneFromSide(null);
      setZoneToSide(null);
    }
  }, [state.step, state.zoneFrom, state.zoneTo]);

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

  // Chave de persistência para este jogo.
  const sessionKey = `volleyiq:scout:${matchId}`;

  // Hidrata o log + estado volátil a partir da API + localStorage.
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
      zoneFromX: a.zoneFromX ?? null,
      zoneFromY: a.zoneFromY ?? null,
      zoneToX: a.zoneToX ?? null,
      zoneToY: a.zoneToY ?? null,
      result: a.result,
      rallyId: a.rallyId ?? "",
      rotation: a.rotation ?? 1,
      setNumber: a.rotation != null ? 1 : 1, // setNumber não existe na DB ainda
      timestamp: new Date(a.timestamp).getTime(),
      side: (a.side as "home" | "away") ?? "home",
      opponentPlayerId: a.opponentPlayerId ?? null,
    }));

    // Reconstrói score a partir do log — mais fiável do que localStorage.
    const setN = mapped.reduce((max, a) => Math.max(max, a.setNumber), 1);
    const inSet = mapped.filter((a) => a.setNumber === setN);
    const homeScore = inSet.filter(
      (a) =>
        (a.type === "attack" && a.result === "kill") ||
        (a.type === "serve" && a.result === "ace") ||
        (a.type === "block" && a.result === "stuff"),
    ).length;
    const awayScore = inSet.filter(
      (a) =>
        a.result === "error" ||
        (a.type === "attack" && a.result === "blocked"),
    ).length;

    // rotation e servingTeam precisam de localStorage — não são reconstruíveis
    // de forma fiável sem replay completo da lógica de side-out.
    let rotation = inSet[inSet.length - 1]?.rotation ?? 1;
    let servingTeam: "home" | "away" = "home";
    try {
      const snap = JSON.parse(
        window.localStorage.getItem(sessionKey) ?? "null",
      ) as { rotation?: number; servingTeam?: "home" | "away" } | null;
      if (snap) {
        if (snap.rotation != null) rotation = snap.rotation;
        if (snap.servingTeam) servingTeam = snap.servingTeam;
      }
    } catch {
      // localStorage indisponível — usa defaults
    }

    // Marca todas as acções já no DB como sincronizadas ANTES de popular o
    // log — assim o sync effect não as re-POSTa após o hydrateSession.
    for (const a of mapped) {
      syncedIds.current.add(a.id);
    }

    dispatch({
      kind: "hydrateSession",
      actions: mapped,
      homeScore,
      awayScore,
      setNumber: setN,
      rotation,
      servingTeam,
    });
    hydratedRef.current = true;
  }, [actionsQuery.data, dispatch, sessionKey]);

  // Persiste rotation e servingTeam após cada alteração (só depois da hidratação).
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(
        sessionKey,
        JSON.stringify({
          rotation: state.rotation,
          servingTeam: state.servingTeam,
        }),
      );
    } catch {
      // ignora — modo privado ou quota excedida
    }
  }, [state.rotation, state.servingTeam, sessionKey]);

  const videoRef = useRef<VideoPanelHandle>(null);

  const createAction = useMutation({
    mutationFn: (a: LoggedAction) =>
      api.post<DbAction>("/api/actions", {
        matchId,
        playerId: a.playerId || null,
        opponentPlayerId: a.opponentPlayerId ?? null,
        side: a.side ?? "home",
        type: a.type,
        result: a.result,
        zoneFrom: a.zoneFrom,
        zoneTo: a.zoneTo,
        zoneFromX: a.zoneFromX ?? null,
        zoneFromY: a.zoneFromY ?? null,
        zoneToX: a.zoneToX ?? null,
        zoneToY: a.zoneToY ?? null,
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

  // IDs que já foram enviados ao servidor (ou estão em voo).
  // IDs pendentes (em voo ou aguardam retry) — expostos na UI.
  const syncedIds = useRef(new Set<string>());
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    for (const a of state.log) {
      if (!syncedIds.current.has(a.id)) {
        syncedIds.current.add(a.id);
        setPendingSync((n) => n + 1);
        createAction.mutate(a, {
          onSuccess: () => setPendingSync((n) => Math.max(0, n - 1)),
          onError: (err: any) => {
            // Permite novo envio na próxima mutação.
            syncedIds.current.delete(a.id);
            setPendingSync((n) => Math.max(0, n - 1));
            toast.error("Acção não guardada — verifica a ligação", {
              description: err?.message,
              action: { label: "OK", onClick: () => {} },
            });
          },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.log.length]);

  const activePlayers = useMemo(
    () => (playersQuery.data ?? []).filter((p) => p.active),
    [playersQuery.data],
  );

  const handleKeyboardUndo = () => {
    const last = state.log[state.log.length - 1];
    if (!last) return;
    const player = activePlayers.find((p) => p.id === last.playerId);
    dispatch({ kind: "undo" });
    syncedIds.current.delete(last.id);
    deleteAction.mutate(last.id);
    toast("Acção apagada", {
      description: player
        ? `#${player.number} · ${ACTION_LABEL[last.type]}`
        : ACTION_LABEL[last.type],
      duration: 2000,
    });
  };

  useScoutKeyboard(state, dispatch, {
    roster: activePlayers,
    onUndo: handleKeyboardUndo,
    onToggleHelp: () => {
      setHelpTab("shortcuts");
      setHelpOpen((v) => !v);
    },
  });

  const lineupsQuery = useQuery({
    queryKey: ["lineups", matchId],
    queryFn: () => api.get<Lineup[]>(`/api/matches/${matchId}/lineups`),
  });
  const subsQuery = useQuery({
    queryKey: ["substitutions", matchId],
    queryFn: () =>
      api.get<Substitution[]>(`/api/matches/${matchId}/substitutions`),
  });

  // Jogadores do adversário — carregados quando scoutScope !== "home".
  const opponentTeamId = matchQuery.data?.opponentTeamId;
  const opponentPlayersQuery = useQuery({
    queryKey: ["opponentPlayers", opponentTeamId],
    queryFn: () =>
      api.get<OpponentPlayer[]>(`/api/opponents/${opponentTeamId}/players`),
    enabled: Boolean(opponentTeamId) && state.scoutScope !== "home",
    staleTime: 10 * 60 * 1000,
  });
  const opponentPlayers = opponentPlayersQuery.data ?? [];

  // Histórico vs este adversário — alimenta as sugestões do painel lateral.
  // 404 = primeiro jogo contra ele; tratado como "sem histórico".
  const opponent = matchQuery.data?.opponent;
  const historyQuery = useQuery<ScoutingHistory | null>({
    queryKey: ["scouting", teamId, opponent],
    queryFn: async () => {
      try {
        return await api.get<ScoutingHistory>(
          `/api/scouting/${encodeURIComponent(opponent!)}?teamId=${teamId}`,
        );
      } catch {
        return null;
      }
    },
    enabled: Boolean(opponent),
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = useMemo(
    () =>
      buildSuggestions({
        log: state.log,
        rotation: state.rotation,
        servingTeam: state.servingTeam,
        setNumber: state.setNumber,
        players: activePlayers,
        history: historyQuery.data ?? null,
      }),
    [
      state.log,
      state.rotation,
      state.servingTeam,
      state.setNumber,
      activePlayers,
      historyQuery.data,
    ],
  );

  const [lineupOpen, setLineupOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);

  const savedLineup = useMemo(
    () =>
      (lineupsQuery.data ?? []).find((l) => l.setNumber === state.setNumber) ??
      null,
    [lineupsQuery.data, state.setNumber],
  );

  /**
   * Lineup base = lineup guardado + substituições aplicadas (sem libero).
   * Fallback: primeiras 6 activas por número.
   */
  const baseLineup = useMemo<(Player | null)[]>(() => {
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

  /**
   * Lineup efectivo = baseLineup com o líbero correto no lugar do central de
   * trás. Muda automaticamente com a rotação e com quem está a servir.
   */
  const lineup = useMemo<(Player | null)[]>(() => {
    const byId = new Map(activePlayers.map((p) => [p.id, p]));
    return getEffectiveLineup(
      baseLineup,
      state.rotation,
      state.servingTeam,
      byId,
      savedLineup?.liberoReceptionId,
      savedLineup?.liberoDefenseId,
    );
  }, [baseLineup, state.rotation, state.servingTeam, activePlayers, savedLineup]);

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
  const lastLogged = state.log[state.log.length - 1] ?? null;

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

  if (activePlayers.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Card>
          <CardContent className="p-10 text-center space-y-4">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <div>
              <p className="font-semibold">Sem jogadoras no plantel</p>
              <p className="text-sm text-muted-foreground mt-1">
                Adiciona jogadoras à equipa antes de abrir o Live Scout.
              </p>
            </div>
            <Button asChild>
              <Link href="/players">Ir para o Plantel</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const step = state.step;

  const progressSteps =
    mode === "complete"
      ? ["Jogadora", "Acção", "Origem", "Destino", "Resultado"]
      : ["Jogadora", "Acção", "Zona", "Resultado"];
  const totalSteps = progressSteps.length;
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
          ? "Toca no campo onde a bola foi contactada (origem)."
          : step === "zoneTo"
            ? "Toca no campo no ponto exacto onde a bola caiu."
            : step === "zone"
              ? "Toca no campo onde a bola caiu (ou salta o passo)."
              : "Regista o resultado da acção.";

  function handleZoneFromSelect(
    zone: Zone,
    side: "opponent" | "ours",
    point: CourtPoint,
  ) {
    setZoneFromSide(side);
    dispatch({ kind: "selectZoneFrom", zone, x: point.x, y: point.y });
  }
  function handleZoneToSelect(
    zone: Zone,
    side: "opponent" | "ours",
    point: CourtPoint,
  ) {
    setZoneToSide(side);
    if (mode === "complete")
      dispatch({ kind: "selectZoneTo", zone, x: point.x, y: point.y });
    else dispatch({ kind: "selectZone", zone, x: point.x, y: point.y });
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
    <TooltipProvider delayDuration={300}>
    <div className="p-3 md:p-6 mx-auto flex flex-col gap-3 md:gap-4 lg:h-[100dvh] lg:overflow-hidden">
      {!welcomeDismissed && (
        <WelcomeBanner
          onOpenHelp={() => {
            openHelp("quickstart");
            dismissWelcome();
          }}
          onDismiss={dismissWelcome}
        />
      )}
      <header className="flex items-center justify-between gap-3 flex-wrap">
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
        <div className="flex items-center gap-1 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <ModeSwitch
                  mode={mode}
                  canUseComplete={canUseComplete}
                  onChange={handleModeChange}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <div>
                  <strong>Lite:</strong> jogadora → acção → zona → resultado.
                </div>
                <div>
                  <strong>Completo:</strong> adiciona origem da bola para
                  trajectórias e heatmaps por origem.
                </div>
                <div className="text-muted-foreground">
                  Carrega no botão de ajuda para mais detalhes.
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          {/* Scope selector — só visível quando há adversário catalogado */}
          {opponentTeamId && (
            <ScopeSelector
              scope={state.scoutScope}
              onChange={(s) => dispatch({ kind: "setScoutScope", scope: s })}
            />
          )}
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openHelp("shortcuts")}
            title="Ajuda (?)"
            aria-label="Ajuda do Live Scout"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
          <Button asChild size="sm" variant="ghost" title="Segunda écran">
            <Link href={`/second-screen/${matchId}`}>
              <Monitor className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Segunda écran</span>
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
          {match.status === "live" && (
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              onClick={() => {
                if (confirm("Marcar jogo como terminado?"))
                  updateMatch.mutate({ status: "finished" });
              }}
              disabled={updateMatch.isPending}
            >
              Terminar jogo
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-3 md:gap-4 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <div className="flex flex-col gap-3 lg:min-h-0 lg:overflow-hidden">
          <ScorePanel
            homeScore={state.homeScore}
            awayScore={state.awayScore}
            setNumber={state.setNumber}
            rotation={state.rotation}
            servingTeam={state.servingTeam}
            onAdjust={(side, delta) =>
              dispatch({ kind: "adjustScore", side, delta })
            }
            onRotate={(direction) => dispatch({ kind: "rotate", direction })}
            onSetServingTeam={(team) =>
              dispatch({ kind: "setServingTeam", team })
            }
            onPrevSet={() => dispatch({ kind: "prevSet" })}
            onNextSet={() => dispatch({ kind: "nextSet" })}
          />

          {/* Team toggle — visível em modo both/neutral */}
          {state.scoutScope !== "home" && (
            <TeamToggle
              activeSide={state.activeSide}
              suggestedSide={deriveNextSide(state.log, state.servingTeam)}
              homeName={match.competition ?? "Nossa equipa"}
              awayName={match.opponent}
              disabled={step !== "idle" && step !== "player"}
              onChange={(side) => dispatch({ kind: "selectSide", side })}
            />
          )}

          {/* Step progress + hint — sempre acima do campo */}
          <div className="rounded-xl border bg-card px-3 py-2 space-y-1.5">
            <StepProgress steps={progressSteps} current={stepNumber - 1} />
            <p className="text-xs text-muted-foreground text-center">{hint}</p>
          </div>

          {/* Fluxo de acção — sempre visível acima do campo, sem necessidade de scroll */}
          <div className="space-y-2">
            {step === "idle" && (
              <>
                <LastActionPill
                  last={lastLogged}
                  player={
                    lastLogged
                      ? activePlayers.find((p) => p.id === lastLogged.playerId) ??
                        null
                      : null
                  }
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    onClick={() =>
                      dispatch({ kind: "quickPoint", winner: "home" })
                    }
                    title="Nós marcámos por erro do adversário (sem acção registada)"
                  >
                    <span className="text-base leading-none mr-1">✓</span>
                    Ponto nosso · erro deles
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-red-400/40 text-red-700 hover:bg-red-50 hover:border-red-400 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => {
                      dispatch({ kind: "quickPoint", winner: "away" });
                    }}
                    title="Adversário marcou por mérito próprio (kill/ace que não foi erro nosso rastreado)"
                  >
                    <span className="text-base leading-none mr-1">✗</span>
                    Ponto deles · mérito deles
                  </Button>
                </div>
              </>
            )}
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

          {/* Lista de jogadores do adversário — acima do campo */}
          {state.activeSide === "away" &&
            state.scoutScope !== "home" &&
            (step === "idle" || step === "player") && (
            <OpponentPlayerGrid
              players={opponentPlayers}
              selectedId={state.opponentPlayerId}
              onSelect={(id) =>
                dispatch({ kind: "selectOpponentPlayer", opponentPlayerId: id })
              }
            />
          )}

          {/* Campo — ocupa todo o espaço restante; SVG escala para caber */}
          <div className="rounded-xl border bg-card p-3 md:p-4 lg:flex-1 lg:min-h-0 lg:relative lg:p-0 lg:overflow-hidden">
            <Court
              selectedZone={state.zoneTo}
              selectedZoneFrom={state.zoneFrom}
              selectedZoneSide={zoneToSide}
              selectedZoneFromSide={zoneFromSide}
              selectedPointFrom={
                state.zoneFromX != null && state.zoneFromY != null && zoneFromSide
                  ? { x: state.zoneFromX, y: state.zoneFromY, side: zoneFromSide }
                  : null
              }
              selectedPointTo={
                state.zoneToX != null && state.zoneToY != null && zoneToSide
                  ? { x: state.zoneToX, y: state.zoneToY, side: zoneToSide }
                  : null
              }
              pickTarget={
                step === "zoneFrom"
                  ? "from"
                  : step === "zoneTo" || step === "zone"
                    ? "to"
                    : null
              }
              onZoneSelect={handleZoneToSelect}
              onZoneFromSelect={handleZoneFromSelect}
              lineup={state.activeSide === "home" ? lineup : [null,null,null,null,null,null]}
              selectedPlayerId={state.activeSide === "home" ? state.playerId : null}
              onPlayerSelect={(id) =>
                dispatch({ kind: "selectPlayer", playerId: id })
              }
              rotation={state.rotation}
              playersDisabled={
                state.activeSide === "away" ||
                (step !== "idle" && step !== "player")
              }
              zonesDisabled={
                step !== "zone" && step !== "zoneFrom" && step !== "zoneTo"
              }
              className="lg:absolute lg:inset-0 lg:w-full lg:h-full"
            />
          </div>
        </div>

        {/* Sugestões + Log lateral + vídeo (opcional) */}
        <aside className="flex flex-col gap-3 min-w-0 lg:min-h-0 lg:overflow-hidden">
          <div className="lg:shrink-0">
            <SuggestionsPanel
              suggestions={suggestions}
              hasLog={state.log.length > 0}
              hasHistory={Boolean(historyQuery.data)}
            />
          </div>
          {match.videoUrl && (
            <div className="rounded-xl border bg-card p-3 md:p-4 space-y-2 lg:shrink-0">
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
          <div className="rounded-xl border bg-card p-3 md:p-4 flex flex-col max-h-[55vh] lg:max-h-none lg:flex-1 lg:min-h-0">
            <ActionLog
              log={state.log}
              players={activePlayers}
              onUndo={handleKeyboardUndo}
              pendingSync={pendingSync}
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

      <KeyboardHelp
        open={helpOpen}
        onOpenChange={setHelpOpen}
        initialTab={helpTab}
      />
    </div>
    </TooltipProvider>
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

// ── Scope selector (Só nós / Ambas) ─────────────────────────────────────────
function ScopeSelector({
  scope,
  onChange,
}: {
  scope: ScoutScope;
  onChange: (s: ScoutScope) => void;
}) {
  return (
    <div className="hidden sm:inline-flex items-stretch rounded-md border overflow-hidden" title="Âmbito do scout">
      {(["home", "both"] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            "px-2.5 h-8 text-xs font-medium transition-colors",
            scope === s
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent text-muted-foreground",
          )}
        >
          {s === "home" ? "Só nós" : "Ambas"}
        </button>
      ))}
    </div>
  );
}

// ── Team toggle strip ────────────────────────────────────────────────────────
function TeamToggle({
  activeSide,
  suggestedSide,
  homeName,
  awayName,
  disabled,
  onChange,
}: {
  activeSide: Side;
  suggestedSide: Side;
  homeName: string;
  awayName: string;
  disabled: boolean;
  onChange: (side: Side) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-xs text-muted-foreground shrink-0">Equipa:</span>
      <div className="inline-flex rounded-md border overflow-hidden">
        {(["home", "away"] as const).map((side) => {
          const isActive = activeSide === side;
          const isSuggested = suggestedSide === side && !isActive;
          return (
            <button
              key={side}
              disabled={disabled}
              onClick={() => onChange(side)}
              className={cn(
                "px-3 h-7 text-xs font-medium transition-colors relative",
                isActive
                  ? side === "home"
                    ? "bg-blue-600 text-white"
                    : "bg-rose-600 text-white"
                  : isSuggested
                    ? "bg-accent ring-1 ring-inset ring-primary/40 text-foreground"
                    : "hover:bg-accent text-muted-foreground",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {side === "home" ? homeName : awayName}
              {isSuggested && (
                <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
      {suggestedSide !== activeSide && !disabled && (
        <span className="text-[10px] text-muted-foreground">sugestão</span>
      )}
    </div>
  );
}

// ── Opponent player grid ─────────────────────────────────────────────────────
function OpponentPlayerGrid({
  players,
  selectedId,
  onSelect,
}: {
  players: OpponentPlayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = [...players].sort((a, b) => (a.number ?? 99) - (b.number ?? 99));

  if (sorted.length === 0) {
    return (
      <p className="text-xs text-center text-muted-foreground py-3">
        Sem jogadores catalogados para este adversário.{" "}
        Adiciona-os em <strong>Adversários</strong>.
      </p>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground mb-2">Jogadores do adversário</p>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              "inline-flex flex-col items-center justify-center rounded-lg border px-2 py-1 text-xs transition-colors",
              selectedId === p.id
                ? "bg-rose-600 text-white border-rose-600"
                : "hover:bg-accent",
            )}
          >
            <span className="font-semibold">#{p.number ?? "?"}</span>
            <span className="text-[10px] opacity-80">{p.position ?? "—"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
