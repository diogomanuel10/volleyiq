import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { motion } from "framer-motion";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { OpponentTeam } from "@shared/schema";

export default function Opponents() {
  const { team } = useTeam();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OpponentTeam | null>(null);

  const listQuery = useQuery({
    queryKey: ["opponents", team?.id],
    queryFn: () => api.get<OpponentTeam[]>(`/api/opponents?teamId=${team!.id}`),
    enabled: !!team,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/opponents/${id}?teamId=${team!.id}`),
    onSuccess: () => {
      toast.success("Adversário removido");
      qc.invalidateQueries({ queryKey: ["opponents", team?.id] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha a remover"),
  });

  if (!team) return null;

  const items = listQuery.data ?? [];

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Adversários
          </h1>
          <p className="text-muted-foreground text-sm">
            Catálogo de equipas adversárias com plantel, treinadores e
            histórico.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Nova equipa adversária
            </Button>
          </DialogTrigger>
          <OpponentDialog
            teamId={team.id}
            editing={editing}
            onSaved={() => {
              setDialogOpen(false);
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["opponents", team.id] });
            }}
          />
        </Dialog>
      </header>

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Ainda não tens adversários catalogados. Começa com{" "}
            <b>Nova equipa adversária</b>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((o, idx) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
            >
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div
                    className="h-10 w-10 shrink-0 rounded-md border"
                    style={{
                      backgroundColor: o.primaryColor ?? "transparent",
                    }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/opponents/${o.id}`}
                      className="font-semibold hover:underline truncate block"
                    >
                      {o.name}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate">
                      {[o.club, o.category, o.division]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(o);
                        setDialogOpen(true);
                      }}
                      aria-label="Editar"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (
                          confirm(
                            `Remover '${o.name}'? O histórico de jogos mantém-se mas perde a associação.`,
                          )
                        )
                          deleteMutation.mutate(o.id);
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

function OpponentDialog({
  teamId,
  editing,
  onSaved,
}: {
  teamId: string;
  editing: OpponentTeam | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [club, setClub] = useState(editing?.club ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [division, setDivision] = useState(editing?.division ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    editing?.primaryColor ?? "#ef4444",
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        teamId,
        name: name.trim(),
        club: club.trim() || null,
        category: category.trim() || null,
        division: division.trim() || null,
        primaryColor: primaryColor || null,
        notes: notes.trim() || null,
      };
      if (editing) {
        return api.patch<OpponentTeam>(
          `/api/opponents/${editing.id}?teamId=${teamId}`,
          body,
        );
      }
      return api.post<OpponentTeam>("/api/opponents", body);
    },
    onSuccess: () => {
      toast.success(editing ? "Adversário actualizado" : "Adversário criado");
      onSaved();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha a gravar"),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {editing ? "Editar adversário" : "Nova equipa adversária"}
        </DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            toast.error("Nome é obrigatório");
            return;
          }
          saveMutation.mutate();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="opp-name">
            Nome <span className="text-destructive">*</span>
          </Label>
          <Input
            id="opp-name"
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Benfica"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="opp-club">Clube</Label>
          <Input
            id="opp-club"
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder="Sport Lisboa e Benfica"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="opp-category">Escalão</Label>
            <Input
              id="opp-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Seniores Femininas"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="opp-division">Divisão</Label>
            <Input
              id="opp-division"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              placeholder="Divisão A1"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="opp-color">Cor principal</Label>
          <div className="flex items-center gap-3">
            <input
              id="opp-color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
              aria-label="Selector de cor"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#ef4444"
              className="max-w-[140px] font-mono"
            />
            <div
              className="h-10 flex-1 rounded-md border"
              style={{ backgroundColor: primaryColor }}
              aria-hidden
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="opp-notes">Notas</Label>
          <Textarea
            id="opp-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Treinador veterano, sistema 5-1…"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending
              ? "A gravar…"
              : editing
                ? "Guardar"
                : "Criar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
