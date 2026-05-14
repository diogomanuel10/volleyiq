import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
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
  CalendarPlus,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
const STATUS_VARIANT: Record<Status, "secondary" | "success" | "warning"> = {
  scheduled: "secondary",
  live: "warning",
  finished: "success",
  cancelled: "secondary",
};

export default function Matches() {
  const { team } = useTeam();
  const { t } = useTranslation();
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
      toast.success(t("matches.deleted"));
      qc.invalidateQueries({ queryKey: ["matches", team?.id] });
    },
    onError: (err: any) => toast.error(err.message ?? t("matches.deleteError")),
  });

  if (!team) return null;

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("matches.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("matches.subtitle", { team: team.name })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDvwOpen(true)}>
            <Upload className="h-4 w-4" /> DataVolley
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> {t("matches.import")}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> {t("matches.newMatch")}
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
              {s === "all" ? t("matches.status.all") : t(`matches.status.${s}`)}
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
      ) : (matchesQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title={t("matches.empty.title")}
          description={t("matches.empty.description")}
          actions={
            <>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" /> {t("matches.newMatch")}
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" /> {t("matches.importCalendar")}
              </Button>
              <Button variant="ghost" onClick={() => setDvwOpen(true)}>
                <Upload className="h-4 w-4" /> {t("matches.importDvw")}
              </Button>
            </>
          }
          footer={
            <>
              💡 {t("matches.empty.dvwHint")}
            </>
          }
        />
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            <span dangerouslySetInnerHTML={{ __html: t("matches.noMatchesFilter", { status: t(`matches.status.${statusFilter}`).toLowerCase() }) }} />{" "}
            <button
              onClick={() => setStatusFilter("all")}
              className="text-primary hover:underline"
            >
              {t("matches.showAll")}
            </button>
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
                        {m.matchType === "observation" ? (
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            {m.opponent}
                          </span>
                        ) : (
                          `vs. ${m.opponent}`
                        )}
                      </div>
                      <Badge variant={STATUS_VARIANT[m.status]}>
                        {STATUS_LABEL[m.status]}
                      </Badge>
                      {m.matchType === "observation" && (
                        <Badge variant="secondary">{t("matches.observation")}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
                      <span>{formatDate(m.date)}</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {t(`matches.venue.${m.venue}`)}
                      </span>
                      {m.competition && <span>{m.competition}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold tabular-nums">
                      {m.setsWon}–{m.setsLost}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{t("matches.sets")}</div>
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
                        if (confirm(t("matches.deleteConfirm", { opponent: m.opponent })))
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
  const { t } = useTranslation();
  const [matchType, setMatchType] = useState<"regular" | "observation">("regular");
  const [opponentTeamId, setOpponentTeamId] = useState<string>("");
  const [opponentTeamBId, setOpponentTeamBId] = useState<string>("");
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState<Match["venue"]>("home");
  const [competition, setCompetition] = useState("");
  const [notes, setNotes] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const opponentsQuery = useQuery({
    queryKey: ["opponents", teamId],
    queryFn: () => api.get<OpponentTeam[]>(`/api/opponents?teamId=${teamId}`),
  });
  const opponentOptions = opponentsQuery.data ?? [];

  function pickOpponentTeamA(id: string) {
    setOpponentTeamId(id);
    if (matchType === "observation") {
      const a = opponentOptions.find((o) => o.id === id);
      const b = opponentOptions.find((o) => o.id === opponentTeamBId);
      if (a && b) setOpponent(`${a.name} vs ${b.name}`);
      else if (a) setOpponent(a.name);
    } else if (id) {
      const hit = opponentOptions.find((o) => o.id === id);
      if (hit) setOpponent(hit.name);
    }
  }

  function pickOpponentTeamB(id: string) {
    setOpponentTeamBId(id);
    const a = opponentOptions.find((o) => o.id === opponentTeamId);
    const b = opponentOptions.find((o) => o.id === id);
    if (a && b) setOpponent(`${a.name} vs ${b.name}`);
    else if (b) setOpponent(b.name);
  }

  function switchType(t: "regular" | "observation") {
    setMatchType(t);
    setOpponentTeamId("");
    setOpponentTeamBId("");
    setOpponent("");
    if (t === "observation") setVenue("neutral");
    else setVenue("home");
  }

  const isObservation = matchType === "observation";
  const canSubmit = isObservation
    ? !!opponentTeamId && !!opponentTeamBId && opponentTeamId !== opponentTeamBId
    : !!opponent;

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Match>("/api/matches", {
        teamId,
        opponent,
        opponentTeamId: opponentTeamId || null,
        opponentTeamBId: isObservation ? (opponentTeamBId || null) : null,
        matchType,
        date: new Date(date).toISOString(),
        venue: isObservation ? "neutral" : venue,
        competition: competition || null,
        notes: notes || null,
        videoUrl: videoUrl.trim() || null,
        setsWon: 0,
        setsLost: 0,
        status: "scheduled",
      }),
    onSuccess: () => {
      toast.success(t("matches.newMatchDialog.created"));
      onCreated();
    },
    onError: (err: any) => toast.error(err.message ?? t("matches.newMatchDialog.createError")),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("matches.newMatchDialog.title")}</DialogTitle>
        <DialogDescription>
          {isObservation
            ? t("matches.newMatchDialog.descriptionObservation")
            : t("matches.newMatchDialog.descriptionRegular")}
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) createMutation.mutate();
        }}
      >
        {/* Match type toggle */}
        <div className="inline-flex rounded-lg border overflow-hidden w-full">
          {(["regular", "observation"] as const).map((mt) => (
            <button
              key={mt}
              type="button"
              onClick={() => switchType(mt)}
              className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                matchType === mt
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {mt === "regular" ? t("matches.newMatchDialog.regular") : t("matches.newMatchDialog.observation")}
            </button>
          ))}
        </div>

        {isObservation ? (
          /* Observation: pick two opponent teams from catalog */
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t("matches.newMatchDialog.observationHint")}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="opp-team-a">{t("matches.newMatchDialog.teamA")}</Label>
              <Select
                id="opp-team-a"
                value={opponentTeamId}
                onChange={(e) => pickOpponentTeamA(e.target.value)}
                required
              >
                <option value="">{t("matches.newMatchDialog.chooseOpponent")}</option>
                {opponentOptions
                  .filter((o) => o.id !== opponentTeamBId)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {o.club ? ` · ${o.club}` : ""}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-team-b">{t("matches.newMatchDialog.teamB")}</Label>
              <Select
                id="opp-team-b"
                value={opponentTeamBId}
                onChange={(e) => pickOpponentTeamB(e.target.value)}
                required
              >
                <option value="">{t("matches.newMatchDialog.chooseOpponent")}</option>
                {opponentOptions
                  .filter((o) => o.id !== opponentTeamId)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {o.club ? ` · ${o.club}` : ""}
                    </option>
                  ))}
              </Select>
            </div>
            {opponentOptions.length < 2 && (
              <p className="text-xs text-amber-600">
                {t("matches.newMatchDialog.needTwoOpponents")}
              </p>
            )}
          </div>
        ) : (
          /* Regular: existing opponent + free text */
          <>
            {opponentOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="opp-team">{t("matches.newMatchDialog.catalogSelect")}</Label>
                <Select
                  id="opp-team"
                  value={opponentTeamId}
                  onChange={(e) => pickOpponentTeamA(e.target.value)}
                >
                  <option value="">{t("matches.newMatchDialog.useFreeText")}</option>
                  {opponentOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {o.club ? ` · ${o.club}` : ""}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("matches.newMatchDialog.catalogHint")}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="opponent">{t("matches.newMatchDialog.opponent")}</Label>
              <Input
                id="opponent"
                value={opponent}
                onChange={(e) => {
                  setOpponent(e.target.value);
                  if (opponentTeamId) setOpponentTeamId("");
                }}
                required
                placeholder="Porto VC"
              />
            </div>
          </>
        )}

        <div className={`grid gap-3 ${isObservation ? "grid-cols-1" : "grid-cols-2"}`}>
          <div className="space-y-1.5">
            <Label htmlFor="date">{t("matches.newMatchDialog.date")}</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          {!isObservation && (
            <div className="space-y-1.5">
              <Label htmlFor="venue">{t("matches.newMatchDialog.venue")}</Label>
              <Select
                id="venue"
                value={venue}
                onChange={(e) => setVenue(e.target.value as Match["venue"])}
              >
                <option value="home">{t("matches.venue.home")}</option>
                <option value="away">{t("matches.venue.away")}</option>
                <option value="neutral">{t("matches.venue.neutral")}</option>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="competition">{t("matches.newMatchDialog.competition")}</Label>
          <Input
            id="competition"
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
            placeholder={t("matches.newMatchDialog.competitionPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="videoUrl">{t("matches.newMatchDialog.videoUrl")}</Label>
          <Input
            id="videoUrl"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder={t("matches.newMatchDialog.videoUrlPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">{t("matches.newMatchDialog.notes")}</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("matches.newMatchDialog.notesPlaceholder")}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={createMutation.isPending || !canSubmit}>
            {isObservation ? t("matches.newMatchDialog.createObservationButton") : t("matches.newMatchDialog.createButton")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
