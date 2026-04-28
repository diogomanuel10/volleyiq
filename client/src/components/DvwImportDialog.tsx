import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  parseDvw,
  readDvwFile,
  type DvwParseResult,
  type DvwPlayer,
} from "@/lib/dvwImport";
import type {
  Match,
  OpponentTeam,
  Player,
  InsertPlayer,
  InsertAction,
} from "@shared/schema";
import type { Position } from "@shared/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teamId: string;
}

type Side = "home" | "away";

export function DvwImportDialog({ open, onOpenChange, teamId }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<DvwParseResult | null>(null);
  const [ourSide, setOurSide] = useState<Side>("home");
  const [createMissingPlayers, setCreateMissingPlayers] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const rosterQuery = useQuery({
    queryKey: ["players", teamId],
    queryFn: () => api.get<Player[]>(`/api/players?teamId=${teamId}`),
    enabled: open,
  });
  const opponentsQuery = useQuery({
    queryKey: ["opponents", teamId],
    queryFn: () => api.get<OpponentTeam[]>(`/api/opponents?teamId=${teamId}`),
    enabled: open,
  });

  function reset() {
    setFileName(null);
    setParsed(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setParsing(true);
    setFileName(file.name);
    try {
      const raw = await readDvwFile(file);
      const result = parseDvw(raw);
      if (result.actions.length === 0) {
        toast.warning("Nenhuma acção reconhecida no ficheiro.");
      }
      setParsed(result);
    } catch (err) {
      toast.error("Não consegui ler o ficheiro DataVolley", {
        description: err instanceof Error ? err.message : String(err),
      });
      reset();
    } finally {
      setParsing(false);
    }
  }

  const summary = useMemo(() => {
    if (!parsed) return null;
    const ours = parsed.actions.filter((a) => a.side === ourSide);
    const theirs = parsed.actions.filter((a) => a.side !== ourSide);
    const ourTeam = ourSide === "home" ? parsed.homeTeam : parsed.awayTeam;
    const oppTeam = ourSide === "home" ? parsed.awayTeam : parsed.homeTeam;
    const ourPlayers = parsed.players.filter((p) => p.side === ourSide);
    const oppPlayers = parsed.players.filter((p) => p.side !== ourSide);
    return { ours, theirs, ourTeam, oppTeam, ourPlayers, oppPlayers };
  }, [parsed, ourSide]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!parsed || !summary) throw new Error("Sem dados parsed");

      // 1) Cria/encontra a opponent team pelo nome.
      const allOpponents = opponentsQuery.data ?? [];
      let opponentTeam =
        allOpponents.find(
          (o) =>
            o.name.trim().toLowerCase() ===
            summary.oppTeam.name.trim().toLowerCase(),
        ) ?? null;
      if (!opponentTeam) {
        opponentTeam = await api.post<OpponentTeam>("/api/opponents", {
          teamId,
          name: summary.oppTeam.name,
          club: null,
          category: null,
          division: null,
          primaryColor: null,
          notes: null,
        });
      }

      // 2) Faz match dos jogadores nossos pelo número; cria os que faltam
      //    se o utilizador o pediu.
      const roster = rosterQuery.data ?? [];
      const byNumber = new Map<number, Player>(
        roster.map((p) => [p.number, p]),
      );
      const created: Player[] = [];
      if (createMissingPlayers) {
        for (const p of summary.ourPlayers) {
          if (byNumber.has(p.number)) continue;
          const insert: InsertPlayer = {
            teamId,
            firstName: p.firstName || "Importado",
            lastName: p.lastName,
            number: p.number,
            position: pickPosition(p),
            heightCm: null,
            dominantHand: null,
            birthDate: null,
            active: true,
          };
          const newPlayer = await api.post<Player>("/api/players", insert);
          byNumber.set(p.number, newPlayer);
          created.push(newPlayer);
        }
      }

      // 3) Cria também os jogadores adversários no opponent_team.
      const oppPlayersExisting = await api.get<
        Array<{ number: number | null }>
      >(
        `/api/opponents/${opponentTeam.id}/players?teamId=${teamId}`,
      );
      const oppNumbers = new Set(
        oppPlayersExisting
          .map((p) => p.number)
          .filter((n): n is number => n != null),
      );
      const oppToCreate = summary.oppPlayers.filter(
        (p) => !oppNumbers.has(p.number),
      );
      if (oppToCreate.length) {
        await api.post(`/api/opponents/${opponentTeam.id}/players/bulk?teamId=${teamId}`, {
          players: oppToCreate.map((p) => ({
            firstName: p.firstName || "—",
            lastName: p.lastName,
            number: p.number,
            position: pickPosition(p),
            heightCm: null,
            dominantHand: null,
            notes: null,
          })),
        });
      }

      // 4) Cria o match.
      const ourSetsWon = summary.ourTeam.setsWon;
      const oppSetsWon = summary.oppTeam.setsWon;
      const status: Match["status"] =
        ourSetsWon + oppSetsWon > 0 ? "finished" : "scheduled";
      const venue: Match["venue"] = ourSide === "home" ? "home" : "away";
      const match = await api.post<Match>("/api/matches", {
        teamId,
        opponent: summary.oppTeam.name,
        opponentTeamId: opponentTeam.id,
        date: (parsed.matchDate ?? new Date()).toISOString(),
        venue,
        competition: parsed.competition,
        notes: `Importado de DataVolley (${fileName ?? "ficheiro"})`,
        videoUrl: null,
        setsWon: ourSetsWon,
        setsLost: oppSetsWon,
        status,
      });

      // 5) Bulk insert das acções da NOSSA equipa.
      const insertActions: InsertAction[] = [];
      let skipped = 0;
      for (const a of summary.ours) {
        const player = byNumber.get(a.playerNumber);
        if (!player) {
          skipped++;
          continue;
        }
        insertActions.push({
          matchId: match.id,
          playerId: player.id,
          type: a.type,
          result: a.result,
          zoneFrom: null,
          zoneTo: null,
          rallyId: null,
          rotation: a.rotation,
          opponentPlayer: null,
          videoTimeSec: null,
          setId: null,
        });
      }
      const insertResp = await api.post<{ inserted: number }>(
        "/api/actions/bulk",
        {
          teamId,
          matchId: match.id,
          actions: insertActions,
        },
      );

      return {
        match,
        opponentTeam,
        playersCreated: created.length,
        actionsInserted: insertResp.inserted,
        actionsSkipped: skipped,
      };
    },
    onSuccess: (data) => {
      toast.success(
        `Importado: ${data.actionsInserted} acções, ${data.playersCreated} jogador(es) novos.`,
        {
          description:
            data.actionsSkipped > 0
              ? `${data.actionsSkipped} acções saltadas (jogador não criado).`
              : undefined,
        },
      );
      qc.invalidateQueries({ queryKey: ["matches", teamId] });
      qc.invalidateQueries({ queryKey: ["players", teamId] });
      qc.invalidateQueries({ queryKey: ["opponents", teamId] });
      reset();
      onOpenChange(false);
      navigate(`/post-match/${data.match.id}`);
    },
    onError: (err) => {
      toast.error("Falha ao importar", {
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar DataVolley (.dvw)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Carrega um ficheiro <code>.dvw</code> exportado do DataVolley
            (ou compatível: ovscout2, Click and Scout). Vou criar o jogo,
            associar à equipa adversária no catálogo (ou criar nova) e
            importar todas as acções da equipa que escolheres como tua.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={parsing || importMutation.isPending}
            >
              <Upload className="h-4 w-4" />
              Escolher ficheiro
            </Button>
            {fileName && (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName}
                <button
                  type="button"
                  onClick={reset}
                  className="hover:text-foreground"
                  aria-label="Remover ficheiro"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              // Aceitamos qualquer ficheiro e deixamos o parser validar pelo
              // conteúdo. Com `.dvw` explícito, alguns browsers (Safari /
              // macOS Finder) cinzentam o ficheiro porque o sistema não
              // reconhece a extensão como UTI conhecido.
              accept="*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {parsing && <Skeleton className="h-32 w-full" />}

          {parsed && summary && (
            <>
              <div className="rounded-md border p-3 text-sm space-y-2">
                <div>
                  <span className="text-muted-foreground">Data: </span>
                  <span className="font-medium">
                    {parsed.matchDate
                      ? parsed.matchDate.toISOString().slice(0, 10)
                      : "(desconhecida)"}
                  </span>
                  {parsed.competition && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {parsed.competition}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <SidePreview
                    label="Casa"
                    team={parsed.homeTeam}
                    selected={ourSide === "home"}
                    onClick={() => setOurSide("home")}
                    playerCount={
                      parsed.players.filter((p) => p.side === "home").length
                    }
                  />
                  <SidePreview
                    label="Fora"
                    team={parsed.awayTeam}
                    selected={ourSide === "away"}
                    onClick={() => setOurSide("away")}
                    playerCount={
                      parsed.players.filter((p) => p.side === "away").length
                    }
                  />
                </div>
                <div className="text-xs text-muted-foreground pt-1">
                  Acções reconhecidas: <b>{parsed.actions.length}</b> de{" "}
                  {parsed.totalScoutLines} linhas (
                  {parsed.unparsedScoutLines} ignoradas).
                </div>
              </div>

              <div className="rounded-md border p-3 text-sm space-y-3">
                <div className="font-medium">A tua equipa neste jogo</div>
                <div className="text-muted-foreground">
                  <span className="text-foreground">{summary.ourTeam.name}</span>{" "}
                  · {summary.ours.length} acções para importar
                </div>
                <UnknownPlayersWarning
                  ourPlayers={summary.ourPlayers}
                  roster={rosterQuery.data ?? []}
                  willCreate={createMissingPlayers}
                />
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createMissingPlayers}
                    onChange={(e) =>
                      setCreateMissingPlayers(e.target.checked)
                    }
                  />
                  Criar jogadores em falta no roster
                </label>
              </div>

              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">Adversário</div>
                <div className="text-muted-foreground">
                  <span className="text-foreground">{summary.oppTeam.name}</span>{" "}
                  · {summary.oppPlayers.length} jogadores no plantel
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Vai ser criado/actualizado em{" "}
                  <Label className="inline">Adversários</Label>. Plantel
                  importado, sem alturas/datas (preenche manualmente depois
                  se quiseres).
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={importMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => importMutation.mutate()}
            disabled={
              !parsed ||
              parsing ||
              importMutation.isPending ||
              summary?.ours.length === 0
            }
          >
            {importMutation.isPending
              ? "A importar…"
              : summary
                ? `Importar ${summary.ours.length} acção(ões)`
                : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SidePreview({
  label,
  team,
  selected,
  onClick,
  playerCount,
}: {
  label: string;
  team: { name: string; setsWon: number; headCoach: string | null };
  selected: boolean;
  onClick: () => void;
  playerCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-md border p-2 transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "hover:bg-accent"
      }`}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{team.name}</div>
      <div className="text-[11px] text-muted-foreground">
        {team.setsWon} set(s) · {playerCount} jogador(es)
      </div>
      {team.headCoach && (
        <div className="text-[11px] text-muted-foreground truncate">
          Tr.: {team.headCoach}
        </div>
      )}
    </button>
  );
}

function UnknownPlayersWarning({
  ourPlayers,
  roster,
  willCreate,
}: {
  ourPlayers: DvwPlayer[];
  roster: Player[];
  willCreate: boolean;
}) {
  const known = new Set(roster.map((p) => p.number));
  const missing = ourPlayers.filter((p) => !known.has(p.number));
  if (missing.length === 0) {
    return (
      <div className="text-xs text-emerald-600 dark:text-emerald-400">
        Todos os jogadores do ficheiro existem no roster.
      </div>
    );
  }
  return (
    <div className="text-xs">
      <span
        className={
          willCreate
            ? "text-amber-600 dark:text-amber-400"
            : "text-destructive"
        }
      >
        {missing.length} jogador(es) não estão no roster:{" "}
        {missing
          .slice(0, 6)
          .map((p) => `#${p.number} ${p.lastName}`)
          .join(", ")}
        {missing.length > 6 ? ` …` : ""}.
      </span>{" "}
      <span className="text-muted-foreground">
        {willCreate
          ? "Vão ser criados."
          : "As acções deles serão saltadas."}
      </span>
    </div>
  );
}

function pickPosition(p: DvwPlayer): Position {
  return (p.positionGuess ?? "OH") as Position;
}
