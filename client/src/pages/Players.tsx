import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Upload, UserCog } from "lucide-react";
import { motion } from "framer-motion";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const POSITION_LABEL: Record<Position, string> = {
  OH: "Ponta",
  OPP: "Oposto",
  MB: "Central",
  S: "Distribuidor",
  L: "Líbero",
  DS: "Defensivo",
};

export default function Players() {
  const { team } = useTeam();
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
      toast.success("Jogadora removida");
      qc.invalidateQueries({ queryKey: ["players", team?.id] });
    },
    onError: (err: any) => toast.error(err.message ?? "Falha a remover"),
  });

  if (!team) return null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Jogadores</h1>
          <p className="text-muted-foreground text-sm">
            Roster de {team.name} — {filtered.length} jogadora(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4" /> Importar
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
                <Plus className="h-4 w-4" /> Nova jogadora
              </Button>
            </DialogTrigger>
            <PlayerDialog
              teamId={team.id}
              editing={editing}
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
          Todas
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
            {POSITION_LABEL[p]}
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-2 text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Mostrar inactivas
        </label>
      </div>

      {playersQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Sem jogadoras. Adiciona a primeira com <b>Nova jogadora</b>.
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
                      <span>{POSITION_LABEL[p.position]}</span>
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
                      aria-label="Editar"
                    >
                      <UserCog className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (
                          confirm(
                            `Remover ${p.firstName} ${p.lastName} do roster?`,
                          )
                        )
                          deleteMutation.mutate(p.id);
                      }}
                      aria-label="Remover"
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

function PlayerDialog({
  teamId,
  editing,
  onSaved,
}: {
  teamId: string;
  editing: Player | null;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(editing?.firstName ?? "");
  const [lastName, setLastName] = useState(editing?.lastName ?? "");
  const [number, setNumber] = useState(editing?.number ?? 1);
  const [position, setPosition] = useState<Position>(editing?.position ?? "OH");
  const [heightCm, setHeightCm] = useState(editing?.heightCm ?? "");
  const [active, setActive] = useState(editing?.active ?? true);

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
      toast.success(editing ? "Jogadora actualizada" : "Jogadora criada");
      onSaved();
    },
    onError: (err: any) => toast.error(err.message ?? "Falha a gravar"),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {editing ? "Editar jogadora" : "Nova jogadora"}
        </DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">Nome</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Apelido</Label>
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
            <Label htmlFor="number">Número</Label>
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
            <Label htmlFor="position">Posição</Label>
            <Select
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p === "OH"
                    ? "OH — Ponta"
                    : p === "OPP"
                      ? "OPP — Oposto"
                      : p === "MB"
                        ? "MB — Central"
                        : p === "S"
                          ? "S — Distribuidor"
                          : p === "L"
                            ? "L — Líbero"
                            : "DS — Defensivo"}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="height">Altura (cm, opcional)</Label>
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
          Activa no roster
        </label>
        <DialogFooter>
          <Button type="submit" disabled={saveMutation.isPending}>
            {editing ? "Guardar" : "Criar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
