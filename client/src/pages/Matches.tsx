import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trophy,
  MapPin,
  Radio,
  ClipboardCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Match, OpponentTeam } from "@shared/schema";
import { MatchImportDialog } from "@/components/MatchImportDialog";
import { DvwImportDialog } from "@/components/DvwImportDialog";

type Status = Match["status"];

const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Agendado",
  live: "Live",
  finished: "Terminado",
  cancelled: "Cancelado",
};
const STATUS_VARIANT: Record<Status, "secondary" | "success" | "warning"> = {
  scheduled: "secondary",
  live: "warning",
  finished: "success",
  cancelled: "secondary",
};

export default function Matches() {
  const { team } = useTeam();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dvwOpen, setDvwOpen] = useState(false);

  const matchesQuery = useQuery({
    queryKey: ["matches", team?.id],
    queryFn: () => api.get<Match[]>(`/api/matches?teamId=${team!.id}`),
    enabled: !!team,
  });

  const filtered = useMemo(() => {
    const all = matchesQuery.data ?? [];
    return statusFilter === "all"
      ? all
      : all.filter((m) => m.status === statusFilter);
  }, [matchesQuery.data, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/matches/${id}?teamId=${team!.id}`),
    onSuccess: () => {
      toast.success("Jogo removido");
      qc.invalidateQueries({ queryKey: ["matches", team?.id] });
    },
    onError: (err: any) => toast.error(err.message ?? "Falha a remover"),
  });

  if (!team) return null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Jogos</h1>
          <p className="text-muted-foreground text-sm">
            Calendário e histórico de {team.name}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDvwOpen(true)}>
            <Upload className="h-4 w-4" /> DataVolley
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Novo jogo
              </Button>
            </DialogTrigger>
            <NewMatchDialog
              teamId={team.id}
              onCreated={() => {
                setDialogOpen(false);
                qc.invalidateQueries({ queryKey: ["matches", team.id] });
              }}
            />
          </Dialog>
        </div>
      </header>

      <MatchImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        teamId={team.id}
        existingMatches={matchesQuery.data ?? []}
      />

      <DvwImportDialog
        open={dvwOpen}
        onOpenChange={setDvwOpen}
        teamId={team.id}
      />

      <div className="flex flex-wrap gap-2 text-sm">
        {(["all", "scheduled", "live", "finished", "cancelled"] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 border transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-accent"
              }`}
            >
              {s === "all" ? "Todos" : STATUS_LABEL[s]}
            </button>
          ),
        )}
      </div>

      {matchesQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Sem jogos {statusFilter !== "all" ? `(${STATUS_LABEL[statusFilter]})` : ""}.
            Cria o primeiro com <b>Novo jogo</b>.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((m, idx) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Card>
                <CardContent className="p-4 flex flex-wrap items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">
                        vs. {m.opponent}
                      </div>
                      <Badge variant={STATUS_VARIANT[m.status]}>
                        {STATUS_LABEL[m.status]}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
                      <span>{formatDate(m.date)}</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {m.venue === "home"
                          ? "Casa"
                          : m.venue === "away"
                            ? "Fora"
                            : "Neutro"}
                      </span>
                      {m.competition && <span>{m.competition}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold tabular-nums">
                      {m.setsWon}–{m.setsLost}
                    </div>
                    <div className="text-[11px] text-muted-foreground">sets</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/scout/${m.id}`}>
                        <Radio className="h-4 w-4" /> Scout
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/matchday/${m.id}`}>
                        <ClipboardCheck className="h-4 w-4" /> Match Day
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Remover jogo vs. ${m.opponent}?`))
                          deleteMutation.mutate(m.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewMatchDialog({
  teamId,
  onCreated,
}: {
  teamId: string;
  onCreated: () => void;
}) {
  const [opponentTeamId, setOpponentTeamId] = useState<string>("");
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [venue, setVenue] = useState<Match["venue"]>("home");
  const [competition, setCompetition] = useState("");
  const [notes, setNotes] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const opponentsQuery = useQuery({
    queryKey: ["opponents", teamId],
    queryFn: () => api.get<OpponentTeam[]>(`/api/opponents?teamId=${teamId}`),
  });
  const opponentOptions = opponentsQuery.data ?? [];

  function pickOpponentTeam(id: string) {
    setOpponentTeamId(id);
    if (id) {
      const hit = opponentOptions.find((o) => o.id === id);
      if (hit) setOpponent(hit.name);
    }
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Match>("/api/matches", {
        teamId,
        opponent,
        opponentTeamId: opponentTeamId || null,
        date: new Date(date).toISOString(),
        venue,
        competition: competition || null,
        notes: notes || null,
        videoUrl: videoUrl.trim() || null,
        setsWon: 0,
        setsLost: 0,
        status: "scheduled",
      }),
    onSuccess: () => {
      toast.success("Jogo criado");
      onCreated();
    },
    onError: (err: any) => toast.error(err.message ?? "Falha a criar"),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Novo jogo</DialogTitle>
        <DialogDescription>
          Agenda um jogo. Podes entrar no Live Scout depois.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        {opponentOptions.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="opp-team">Equipa adversária (catálogo)</Label>
            <Select
              id="opp-team"
              value={opponentTeamId}
              onChange={(e) => pickOpponentTeam(e.target.value)}
            >
              <option value="">— usar texto livre abaixo —</option>
              {opponentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.club ? ` · ${o.club}` : ""}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              Escolher daqui associa o jogo à ficha do adversário (plantel,
              equipa técnica, histórico).
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="opponent">Adversário</Label>
          <Input
            id="opponent"
            value={opponent}
            onChange={(e) => {
              setOpponent(e.target.value);
              // Editar manualmente quebra a associação ao catálogo.
              if (opponentTeamId) setOpponentTeamId("");
            }}
            required
            placeholder="Porto VC"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="venue">Local</Label>
            <Select
              id="venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value as Match["venue"])}
            >
              <option value="home">Casa</option>
              <option value="away">Fora</option>
              <option value="neutral">Neutro</option>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="competition">Competição (opcional)</Label>
          <Input
            id="competition"
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
            placeholder="Liga, Taça, Amigável…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="videoUrl">Vídeo (YouTube, opcional)</Label>
          <Input
            id="videoUrl"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações tácticas, lesões, etc."
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={createMutation.isPending}>
            Criar jogo
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
