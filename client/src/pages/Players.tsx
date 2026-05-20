import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Plus, Trash2, Upload, UserCog, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { POSITIONS, type Position } from "@shared/types";
import type { Player } from "@shared/schema";
import { PlayerImportDialog } from "@/components/PlayerImportDialog";

export default function Players() {
  const { team } = useTeam();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [positionFilter, setPositionFilter] = useState<"all" | Position>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);

  const playersQuery = useQuery({
    queryKey: ["players", team?.id],
    queryFn: () => api.get<Player[]>(`/api/players?teamId=${team!.id}`),
    enabled: !!team,
  });

  const filtered = useMemo(() => {
    const all = playersQuery.data ?? [];
    return all
      .filter((p) => showInactive || p.active)
      .filter(
        (p) => positionFilter === "all" || p.position === positionFilter,
      )
      .sort((a, b) => a.number - b.number);
  }, [playersQuery.data, positionFilter, showInactive]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/players/${id}?teamId=${team!.id}`),
    onSuccess: () => {
      toast.success(t("players.deleted"));
      qc.invalidateQueries({ queryKey: ["players", team?.id] });
    },
    onError: (err: any) => toast.error(err.message ?? t("players.deleteError")),
  });

  if (!team) return null;

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("players.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("players.subtitle", { team: team.name, count: filtered.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4" /> {t("players.import")}
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(v) => {
              setDialogOpen(v);
              if (!v) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> {t("players.newPlayer")}
              </Button>
            </DialogTrigger>
            <PlayerDialog
              teamId={team.id}
              editing={editing}
              existingNumbers={(playersQuery.data ?? []).map((p) => p.number)}
              onSaved={() => {
                setDialogOpen(false);
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["players", team.id] });
              }}
            />
          </Dialog>
        </div>
      </header>

      <PlayerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        teamId={team.id}
        existingNumbers={(playersQuery.data ?? []).map((p) => p.number)}
      />

      <div className="flex flex-wrap gap-2 text-sm items-center">
        <button
          onClick={() => setPositionFilter("all")}
          className={`rounded-full px-3 py-1 border transition-colors ${
            positionFilter === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "hover:bg-accent"
          }`}
        >
          {t("players.filterAll")}
        </button>
        {POSITIONS.map((p) => (
          <button
            key={p}
            onClick={() => setPositionFilter(p)}
            className={`rounded-full px-3 py-1 border transition-colors ${
              positionFilter === p
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-accent"
            }`}
          >
            {t(`players.positions.${p}`)}
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-2 text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          {t("players.showInactive")}
        </label>
      </div>

      {playersQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (playersQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("players.empty.title")}
          description={t("players.empty.description")}
          actions={
            <>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" /> {t("players.newPlayer")}
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" /> {t("players.import")}
              </Button>
            </>
          }
          footer={
            <>💡 {t("players.empty.hint")}</>
          }
        />
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            {t("players.noPlayersFilter")}{" "}
            <button
              onClick={() => {
                setPositionFilter("all");
                setShowInactive(true);
              }}
              className="text-primary hover:underline"
            >
              {t("players.clearFilters")}
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
            >
              <Card className={p.active ? "" : "opacity-60"}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-12 w-12 shrink-0">
                    {p.photoUrl && <AvatarImage src={p.photoUrl} alt={`${p.firstName} ${p.lastName}`} className="object-cover" />}
                    <AvatarFallback>
                      {p.firstName[0]}
                      {p.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/players/${p.id}`}
                      className="font-semibold hover:underline truncate block"
                    >
                      {p.firstName} {p.lastName}
                    </Link>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary">#{p.number}</Badge>
                      <span>{t(`players.positions.${p.position}`)}</span>
                      {p.heightCm && <span>· {p.heightCm} cm</span>}
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(p);
                        setDialogOpen(true);
                      }}
                      aria-label={t("common.edit")}
                    >
                      <UserCog className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (
                          confirm(
                            t("players.deleteConfirm", { name: `${p.firstName} ${p.lastName}` }),
                          )
                        )
                          deleteMutation.mutate(p.id);
                      }}
                      aria-label={t("common.delete")}
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

function nextFreeNumber(existing: number[]): number {
  const used = new Set(existing);
  for (let n = 1; n <= 99; n++) if (!used.has(n)) return n;
  return 1;
}

function PlayerDialog({
  teamId,
  editing,
  existingNumbers = [],
  onSaved,
}: {
  teamId: string;
  editing: Player | null;
  existingNumbers?: number[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState(editing?.firstName ?? "");
  const [lastName, setLastName] = useState(editing?.lastName ?? "");
  const [number, setNumber] = useState(
    editing?.number ?? nextFreeNumber(existingNumbers),
  );
  const [position, setPosition] = useState<Position>(editing?.position ?? "OH");
  const [heightCm, setHeightCm] = useState(editing?.heightCm ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(editing?.photoUrl ?? undefined);
  const [photoLoading, setPhotoLoading] = useState(false);

  async function handlePhotoFile(file: File) {
    setPhotoLoading(true);
    try {
      const compressed = await new Promise<string>((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const MAX = 400;
          const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        img.src = url;
      });
      setPhotoUrl(compressed);
    } finally {
      setPhotoLoading(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        teamId,
        firstName,
        lastName,
        number: Number(number),
        position,
        heightCm: heightCm === "" ? null : Number(heightCm),
        active,
        photoUrl: photoUrl ?? null,
      };
      if (editing) {
        return api.patch<Player>(
          `/api/players/${editing.id}?teamId=${teamId}`,
          body,
        );
      }
      return api.post<Player>("/api/players", body);
    },
    onSuccess: () => {
      toast.success(editing ? t("players.dialog.savedEdit") : t("players.dialog.savedNew"));
      onSaved();
    },
    onError: (err: any) => toast.error(err.message ?? t("players.dialog.saveError")),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {editing ? t("players.dialog.titleEdit") : t("players.dialog.titleNew")}
        </DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        {/* Photo upload */}
        <div className="flex justify-center">
          <label className="relative cursor-pointer group">
            <div className="h-20 w-20 rounded-full overflow-hidden bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground border-2 border-dashed border-muted-foreground/30 group-hover:border-primary transition-colors">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{firstName?.[0]}{lastName?.[0]}</span>
              )}
            </div>
            <div className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
              {photoLoading ? (
                <span className="text-[10px] text-white">…</span>
              ) : (
                <Camera className="h-3 w-3 text-white" />
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoFile(file);
              }}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">{t("players.dialog.firstName")}</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">{t("players.dialog.lastName")}</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="number">{t("players.dialog.number")}</Label>
            <Input
              id="number"
              type="number"
              min={1}
              max={99}
              value={number}
              onChange={(e) => setNumber(Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="position">{t("players.dialog.position")}</Label>
            <Select
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {t(`players.positionsFull.${p}`)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="height">{t("players.dialog.height")}</Label>
          <Input
            id="height"
            type="number"
            min={100}
            max={230}
            value={heightCm as any}
            onChange={(e) =>
              setHeightCm(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          {t("players.dialog.active")}
        </label>
        <DialogFooter>
          <Button type="submit" disabled={saveMutation.isPending}>
            {editing ? t("players.dialog.save") : t("players.dialog.create")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
