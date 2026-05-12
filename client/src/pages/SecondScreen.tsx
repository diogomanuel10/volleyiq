import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Radio, Wifi, WifiOff, ArrowLeft } from "lucide-react";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import {
  subscribeMatchActions,
  type MirroredAction,
} from "@/lib/firestoreClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Match, Player, Action as DbAction } from "@shared/schema";
import { ACTION_LABEL, RESULT_LABEL, RESULT_COLOR } from "@shared/types";

/**
 * Vista "segunda-écran" — só leitura, optimizada para um tablet no banco.
 * Prefere Firestore em tempo real quando o mirror está activo; caso
 * contrário, faz polling do endpoint REST a cada 2s.
 */

interface MirrorStatus {
  mirror: { enabled: boolean; ready: boolean; initFailed: boolean };
}

export default function SecondScreen() {
  const params = useParams<{ matchId: string }>();
  const { team } = useTeam();
  const [live, setLive] = useState<MirroredAction[]>([]);
  const [source, setSource] = useState<"firestore" | "polling">("polling");

  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: () => api.get<MirrorStatus>("/api/config"),
    staleTime: 60_000,
  });

  const matchQuery = useQuery({
    queryKey: ["matches", team?.id],
    queryFn: () => api.get<Match[]>(`/api/matches?teamId=${team!.id}`),
    enabled: !!team,
    select: (all) => all.find((m) => m.id === params.matchId) ?? null,
  });

  const playersQuery = useQuery({
    queryKey: ["players", team?.id],
    queryFn: () => api.get<Player[]>(`/api/players?teamId=${team!.id}`),
    enabled: !!team,
  });

  // Polling fallback — sempre activo, desligado quando Firestore arranca.
  const pollingQuery = useQuery({
    queryKey: ["actions", params.matchId],
    queryFn: () =>
      api.get<DbAction[]>(`/api/matches/${params.matchId}/actions`),
    refetchInterval: source === "polling" ? 2000 : false,
    enabled: !!params.matchId,
  });

  useEffect(() => {
    if (!params.matchId) return;
    if (!configQuery.data?.mirror.enabled) return;
    const unsub = subscribeMatchActions(params.matchId, (actions) => {
      setLive(actions);
      setSource("firestore");
    });
    if (!unsub) return;
    return () => unsub();
  }, [params.matchId, configQuery.data?.mirror.enabled]);

  const actions: MirroredAction[] = useMemo(() => {
    if (source === "firestore") return live;
    return (pollingQuery.data ?? []).map((a) => ({
      id: a.id,
      matchId: a.matchId,
      playerId: a.playerId ?? null,
      type: a.type,
      result: a.result,
      zoneTo: a.zoneTo ?? null,
      rallyId: a.rallyId ?? null,
      rotation: a.rotation ?? null,
      videoTimeSec: a.videoTimeSec ?? null,
      timestamp: new Date(a.timestamp).toISOString(),
    }));
  }, [source, live, pollingQuery.data]);

  const playerById = useMemo(() => {
    return new Map((playersQuery.data ?? []).map((p) => [p.id, p]));
  }, [playersQuery.data]);

  const kpis = useMemo(() => {
    const kills = actions.filter(
      (a) => a.type === "attack" && a.result === "kill",
    ).length;
    const aces = actions.filter(
      (a) => a.type === "serve" && a.result === "ace",
    ).length;
    const stuffs = actions.filter(
      (a) => a.type === "block" && a.result === "stuff",
    ).length;
    const errs = actions.filter((a) => a.result === "error").length;
    return { kills, aces, stuffs, errs };
  }, [actions]);

  if (!team) return null;

  const match = matchQuery.data;
  const recent = [...actions].slice(-30).reverse();

  return (
    <div className="p-3 md:p-6 max-w-screen-2xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button asChild variant="ghost" size="icon">
            <Link href="/matches">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold tracking-tight truncate flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" /> Segunda écran
            </h1>
            <div className="text-xs text-muted-foreground truncate">
              {match ? `vs. ${match.opponent}` : "A ligar…"}
            </div>
          </div>
        </div>
        <Badge
          variant={source === "firestore" ? "success" : "secondary"}
          className="gap-1"
        >
          {source === "firestore" ? (
            <>
              <Wifi className="h-3 w-3" /> Firestore live
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" /> Polling 2s
            </>
          )}
        </Badge>
      </header>

      {match && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground">Sets</div>
              <div className="text-3xl font-bold tabular-nums">
                {match.setsWon}–{match.setsLost}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground">Kills</div>
              <div className="text-3xl font-bold tabular-nums text-emerald-600">
                {kpis.kills}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground">Aces / Blocks</div>
              <div className="text-3xl font-bold tabular-nums">
                {kpis.aces} / {kpis.stuffs}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground">Erros</div>
              <div className="text-3xl font-bold tabular-nums text-red-500">
                {kpis.errs}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              Sem acções registadas ainda.
            </div>
          ) : (
            <ul className="divide-y">
              {recent.map((a) => {
                const p = a.playerId ? playerById.get(a.playerId) : null;
                const label = ACTION_LABEL[a.type as keyof typeof ACTION_LABEL] ?? a.type;
                const result =
                  RESULT_LABEL[a.result as keyof typeof RESULT_LABEL] ??
                  a.result;
                const color =
                  RESULT_COLOR[a.result as keyof typeof RESULT_COLOR] ??
                  "bg-slate-500 text-white";
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="text-xs text-muted-foreground font-mono w-14 shrink-0">
                      {a.timestamp
                        ? new Date(a.timestamp).toLocaleTimeString("pt-PT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                      {p ? (
                        <>
                          <span className="font-semibold">#{p.number}</span>{" "}
                          {p.firstName} {p.lastName}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      <span className="text-muted-foreground ml-2">
                        {label}
                        {a.zoneTo ? ` · Z${a.zoneTo}` : ""}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${color}`}
                    >
                      {result}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        {configQuery.data?.mirror.enabled
          ? "Mirror Firestore activo no servidor. Cada acção registada no Live Scout aparece aqui em ~ms."
          : "Firestore mirror desligado (FIRESTORE_MIRROR!=true). A página actualiza por polling a cada 2s."}
      </p>
    </div>
  );
}
