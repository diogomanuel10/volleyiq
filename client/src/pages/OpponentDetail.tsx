import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Edit3,
  Plus,
  Trash2,
  Users,
  UserCog,
  ClipboardList,
  BookOpen,
} from "lucide-react";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { POSITIONS, type Position } from "@shared/types";
import type {
  OpponentCoach,
  OpponentPlayer,
  OpponentTeam,
  Match,
} from "@shared/schema";

type Tab = "info" | "roster" | "staff" | "history";

export default function OpponentDetail() {
  const { t } = useTranslation();
  const [, params] = useRoute<{ id: string }>("/opponents/:id");
  const [, setLocation] = useLocation();
  const { team } = useTeam();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("info");
  const id = params?.id;

  const oppQuery = useQuery({
    queryKey: ["opponent", id, team?.id],
    queryFn: () =>
      api.get<OpponentTeam>(`/api/opponents/${id}?teamId=${team!.id}`),
    enabled: !!id && !!team,
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(`/api/opponents/${id}?teamId=${team!.id}`),
    onSuccess: () => {
      toast.success(t("opponentDetail.deleted"));
      qc.invalidateQueries({ queryKey: ["opponents", team?.id] });
      setLocation("/opponents");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : t("opponentDetail.deleteError")),
  });

  if (!team || !id) return null;

  if (oppQuery.isLoading || !oppQuery.data) {
    return (
      <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const opp = oppQuery.data;

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-6">
      <Link
        href="/opponents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("opponentDetail.backToOpponents")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="h-14 w-14 rounded-xl border shrink-0"
            style={{ backgroundColor: opp.primaryColor ?? "transparent" }}
            aria-hidden
          />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
              {opp.name}
            </h1>
            <div className="text-sm text-muted-foreground truncate">
              {[opp.club, opp.category, opp.division]
                .filter(Boolean)
                .join(" · ") || t("opponentDetail.noAdditionalData")}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <EditOpponentButton opp={opp} teamId={team.id} />
          <Button
            variant="outline"
            onClick={() => {
              if (confirm(t("opponentDetail.deleteConfirm", { name: opp.name })))
                deleteMutation.mutate();
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </header>

      <TabBar tab={tab} onChange={setTab} />

      {tab === "info" && <InfoTab opp={opp} />}
      {tab === "roster" && <RosterTab opponentTeamId={opp.id} teamId={team.id} />}
      {tab === "staff" && <StaffTab opponentTeamId={opp.id} teamId={team.id} />}
      {tab === "history" && <HistoryTab opponentTeamId={opp.id} teamId={team.id} />}
    </div>
  );
}

function TabBar({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  const { t } = useTranslation();
  const items: Array<{ id: Tab; label: string; icon: typeof Users }> = [
    { id: "info", label: t("opponentDetail.tabs.info"), icon: BookOpen },
    { id: "roster", label: t("opponentDetail.tabs.roster"), icon: Users },
    { id: "staff", label: t("opponentDetail.tabs.staff"), icon: UserCog },
    { id: "history", label: t("opponentDetail.tabs.history"), icon: ClipboardList },
  ];
  return (
    <div className="border-b flex gap-1 overflow-x-auto">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors",
            tab === it.id
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <it.icon className="h-4 w-4" />
          {it.label}
        </button>
      ))}
    </div>
  );
}

function InfoTab({ opp }: { opp: OpponentTeam }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Field label={t("opponentDetail.info.name")} value={opp.name} />
        <Field label={t("opponentDetail.info.club")} value={opp.club ?? "—"} />
        <Field label={t("opponentDetail.info.category")} value={opp.category ?? "—"} />
        <Field label={t("opponentDetail.info.division")} value={opp.division ?? "—"} />
        <div>
          <div className="text-xs text-muted-foreground mb-1">{t("opponentDetail.info.primaryColor")}</div>
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-md border"
              style={{ backgroundColor: opp.primaryColor ?? "transparent" }}
              aria-hidden
            />
            <span className="font-mono text-sm">
              {opp.primaryColor ?? "—"}
            </span>
          </div>
        </div>
        <Field label={t("opponentDetail.info.notes")} value={opp.notes ?? "—"} multiline />
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={multiline ? "whitespace-pre-wrap" : ""}>{value}</div>
    </div>
  );
}

// ── Roster tab ────────────────────────────────────────────────────────────

function RosterTab({
  opponentTeamId,
  teamId,
}: {
  opponentTeamId: string;
  teamId: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OpponentPlayer | null>(null);

  const query = useQuery({
    queryKey: ["opponent-roster", opponentTeamId],
    queryFn: () =>
      api.get<OpponentPlayer[]>(
        `/api/opponents/${opponentTeamId}/players?teamId=${teamId}`,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(
        `/api/opponents/${opponentTeamId}/players/${id}?teamId=${teamId}`,
      ),
    onSuccess: () => {
      toast.success(t("opponentDetail.roster.deleted"));
      qc.invalidateQueries({ queryKey: ["opponent-roster", opponentTeamId] });
    },
  });

  const items = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("opponentDetail.roster.count", { count: items.length })}
        </p>
        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> {t("opponentDetail.roster.addButton")}
            </Button>
          </DialogTrigger>
          <OpponentPlayerDialog
            opponentTeamId={opponentTeamId}
            teamId={teamId}
            editing={editing}
            onSaved={() => {
              setDialogOpen(false);
              setEditing(null);
              qc.invalidateQueries({
                queryKey: ["opponent-roster", opponentTeamId],
              });
            }}
          />
        </Dialog>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {t("opponentDetail.roster.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">{t("opponentDetail.roster.number")}</th>
                <th className="px-3 py-2 text-left">{t("opponentDetail.roster.name")}</th>
                <th className="px-3 py-2 text-left">{t("opponentDetail.roster.position")}</th>
                <th className="px-3 py-2 text-left">{t("opponentDetail.roster.height")}</th>
                <th className="px-3 py-2 text-left">{t("opponentDetail.roster.notes")}</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-mono">
                    {p.number != null ? `#${p.number}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-3 py-2">
                    {p.position ? t(`players.positions.${p.position}`) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {p.heightCm ? `${p.heightCm} cm` : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">
                    {p.notes ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(p);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(t("opponentDetail.roster.deleteConfirm", { firstName: p.firstName, lastName: p.lastName })))
                            deleteMutation.mutate(p.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OpponentPlayerDialog({
  opponentTeamId,
  teamId,
  editing,
  onSaved,
}: {
  opponentTeamId: string;
  teamId: string;
  editing: OpponentPlayer | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState(editing?.firstName ?? "");
  const [lastName, setLastName] = useState(editing?.lastName ?? "");
  const [number, setNumber] = useState<string>(
    editing?.number != null ? String(editing.number) : "",
  );
  const [position, setPosition] = useState<Position | "">(
    editing?.position ?? "",
  );
  const [heightCm, setHeightCm] = useState<string>(
    editing?.heightCm != null ? String(editing.heightCm) : "",
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        number: number === "" ? null : Number(number),
        position: position === "" ? null : position,
        heightCm: heightCm === "" ? null : Number(heightCm),
        notes: notes.trim() || null,
      };
      if (editing) {
        return api.patch<OpponentPlayer>(
          `/api/opponents/${opponentTeamId}/players/${editing.id}?teamId=${teamId}`,
          body,
        );
      }
      return api.post<OpponentPlayer>(
        `/api/opponents/${opponentTeamId}/players?teamId=${teamId}`,
        body,
      );
    },
    onSuccess: () => {
      toast.success(editing ? t("opponentDetail.playerDialog.updated") : t("opponentDetail.playerDialog.added"));
      onSaved();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : t("opponentDetail.playerDialog.saveError")),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {editing ? t("opponentDetail.playerDialog.titleEdit") : t("opponentDetail.playerDialog.titleNew")}
        </DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!firstName.trim() || !lastName.trim()) {
            toast.error(t("opponentDetail.playerDialog.nameRequired"));
            return;
          }
          save.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="op-fn">{t("opponentDetail.playerDialog.firstName")}</Label>
            <Input
              id="op-fn"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-ln">{t("opponentDetail.playerDialog.lastName")}</Label>
            <Input
              id="op-ln"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="op-num">{t("opponentDetail.playerDialog.number")}</Label>
            <Input
              id="op-num"
              type="number"
              min={1}
              max={99}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder={t("opponentDetail.playerDialog.numberOptional")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-pos">{t("opponentDetail.playerDialog.position")}</Label>
            <Select
              id="op-pos"
              value={position}
              onChange={(e) => setPosition(e.target.value as Position | "")}
            >
              <option value="">{t("opponentDetail.playerDialog.positionOptional")}</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {t(`players.positions.${p}`)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="op-h">{t("opponentDetail.playerDialog.height")}</Label>
          <Input
            id="op-h"
            type="number"
            min={100}
            max={230}
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="op-nt">{t("opponentDetail.playerDialog.notes")}</Label>
          <Textarea
            id="op-nt"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={save.isPending}>
            {editing ? t("opponentDetail.playerDialog.save") : t("opponentDetail.playerDialog.add")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ── Staff tab ─────────────────────────────────────────────────────────────

function StaffTab({
  opponentTeamId,
  teamId,
}: {
  opponentTeamId: string;
  teamId: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OpponentCoach | null>(null);

  const query = useQuery({
    queryKey: ["opponent-staff", opponentTeamId],
    queryFn: () =>
      api.get<OpponentCoach[]>(
        `/api/opponents/${opponentTeamId}/coaches?teamId=${teamId}`,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(
        `/api/opponents/${opponentTeamId}/coaches/${id}?teamId=${teamId}`,
      ),
    onSuccess: () => {
      toast.success(t("opponentDetail.staff.deleted"));
      qc.invalidateQueries({ queryKey: ["opponent-staff", opponentTeamId] });
    },
  });

  const items = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("opponentDetail.staff.count", { count: items.length })}
        </p>
        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> {t("opponentDetail.staff.addButton")}
            </Button>
          </DialogTrigger>
          <OpponentCoachDialog
            opponentTeamId={opponentTeamId}
            teamId={teamId}
            editing={editing}
            onSaved={() => {
              setDialogOpen(false);
              setEditing(null);
              qc.invalidateQueries({
                queryKey: ["opponent-staff", opponentTeamId],
              });
            }}
          />
        </Dialog>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {t("opponentDetail.staff.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  {c.role && (
                    <Badge variant="secondary" className="mt-1">
                      {c.role}
                    </Badge>
                  )}
                  {c.notes && (
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                      {c.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(c);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(t("opponentDetail.staff.deleteConfirm", { name: c.name })))
                        deleteMutation.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function OpponentCoachDialog({
  opponentTeamId,
  teamId,
  editing,
  onSaved,
}: {
  opponentTeamId: string;
  teamId: string;
  editing: OpponentCoach | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(editing?.name ?? "");
  const [role, setRole] = useState(editing?.role ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        role: role.trim() || null,
        notes: notes.trim() || null,
      };
      if (editing) {
        return api.patch<OpponentCoach>(
          `/api/opponents/${opponentTeamId}/coaches/${editing.id}?teamId=${teamId}`,
          body,
        );
      }
      return api.post<OpponentCoach>(
        `/api/opponents/${opponentTeamId}/coaches?teamId=${teamId}`,
        body,
      );
    },
    onSuccess: () => {
      toast.success(editing ? t("opponentDetail.coachDialog.updated") : t("opponentDetail.coachDialog.added"));
      onSaved();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : t("opponentDetail.coachDialog.saveError")),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {editing ? t("opponentDetail.coachDialog.titleEdit") : t("opponentDetail.coachDialog.titleNew")}
        </DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            toast.error(t("opponentDetail.coachDialog.nameRequired"));
            return;
          }
          save.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="oc-name">{t("opponentDetail.coachDialog.name")}</Label>
          <Input
            id="oc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="oc-role">{t("opponentDetail.coachDialog.role")}</Label>
          <Input
            id="oc-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t("opponentDetail.coachDialog.rolePlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="oc-notes">{t("opponentDetail.coachDialog.notes")}</Label>
          <Textarea
            id="oc-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={save.isPending}>
            {editing ? t("opponentDetail.coachDialog.save") : t("opponentDetail.coachDialog.add")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ── History tab ───────────────────────────────────────────────────────────

function HistoryTab({
  opponentTeamId,
  teamId,
}: {
  opponentTeamId: string;
  teamId: string;
}) {
  const query = useQuery({
    queryKey: ["opponent-history", opponentTeamId],
    queryFn: () =>
      api.get<Match[]>(
        `/api/opponents/${opponentTeamId}/matches?teamId=${teamId}`,
      ),
  });
  const items = query.data ?? [];

  if (query.isLoading) return <Skeleton className="h-32 w-full" />;

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Ainda não há jogos associados a esta equipa. Cria um jogo novo
          (em <b>Jogos</b>) e escolhe esta equipa no campo adversário, ou
          importa o calendário.
        </CardContent>
      </Card>
    );
  }

  const wins = items.filter((m) => m.setsWon > m.setsLost).length;
  const losses = items.filter((m) => m.setsLost > m.setsWon).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          <b>{items.length}</b> jogo(s) registado(s)
        </span>
        <span className="text-emerald-600 dark:text-emerald-400">
          <b>{wins}</b> vitória(s)
        </span>
        <span className="text-destructive">
          <b>{losses}</b> derrota(s)
        </span>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Local</th>
              <th className="px-3 py-2 text-left">Competição</th>
              <th className="px-3 py-2 text-left">Resultado</th>
              <th className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2">{formatDate(new Date(m.date))}</td>
                <td className="px-3 py-2">
                  {m.venue === "home"
                    ? "Casa"
                    : m.venue === "away"
                      ? "Fora"
                      : "Neutro"}
                </td>
                <td className="px-3 py-2">{m.competition ?? "—"}</td>
                <td className="px-3 py-2 font-mono">
                  {m.status === "finished"
                    ? `${m.setsWon}–${m.setsLost}`
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  {m.status === "finished"
                    ? "Terminado"
                    : m.status === "scheduled"
                      ? "Agendado"
                      : m.status === "live"
                        ? "Live"
                        : "Cancelado"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Edit button (shared modal) ────────────────────────────────────────────

function EditOpponentButton({
  opp,
  teamId,
}: {
  opp: OpponentTeam;
  teamId: string;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [name, setName] = useState(opp.name);
  const [club, setClub] = useState(opp.club ?? "");
  const [category, setCategory] = useState(opp.category ?? "");
  const [division, setDivision] = useState(opp.division ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    opp.primaryColor ?? "#ef4444",
  );
  const [notes, setNotes] = useState(opp.notes ?? "");

  const save = useMutation({
    mutationFn: () =>
      api.patch<OpponentTeam>(`/api/opponents/${opp.id}?teamId=${teamId}`, {
        name: name.trim(),
        club: club.trim() || null,
        category: category.trim() || null,
        division: division.trim() || null,
        primaryColor: primaryColor || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Actualizado");
      qc.invalidateQueries({ queryKey: ["opponent", opp.id] });
      qc.invalidateQueries({ queryKey: ["opponents", teamId] });
      setOpen(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha a gravar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Edit3 className="h-4 w-4" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar adversário</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              toast.error("Nome é obrigatório");
              return;
            }
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Nome</Label>
            <Input
              id="e-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-club">Clube</Label>
            <Input
              id="e-club"
              value={club}
              onChange={(e) => setClub(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-cat">Escalão</Label>
              <Input
                id="e-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-div">Divisão</Label>
              <Input
                id="e-div"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-color">Cor principal</Label>
            <div className="flex items-center gap-3">
              <input
                id="e-color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="max-w-[140px] font-mono"
              />
              <div
                className="h-10 flex-1 rounded-md border"
                style={{ backgroundColor: primaryColor }}
                aria-hidden
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-notes">Notas</Label>
            <Textarea
              id="e-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
