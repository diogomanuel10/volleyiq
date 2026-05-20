import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Plus, LayoutPanelLeft, Trash2, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { useTeam } from "@/hooks/useTeam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Board } from "@shared/schema";

export default function Boards() {
  const { team } = useTeam();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["boards", team?.id],
    queryFn: () => api.get<Board[]>(`/api/boards?teamId=${team!.id}`),
    enabled: !!team,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api.post<Board>("/api/boards", { teamId: team!.id, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boards", team?.id] });
      setCreateOpen(false);
      setNewName("");
      toast.success("Apresentação criada");
    },
    onError: () => toast.error("Erro ao criar apresentação"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/boards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boards", team?.id] });
      setDeleteId(null);
      toast.success("Apresentação eliminada");
    },
    onError: () => toast.error("Erro ao eliminar"),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate(newName.trim());
  }

  if (!team) return null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Apresentações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quadros táticos e apresentações para a equipa
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova apresentação
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && boards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LayoutPanelLeft className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhuma apresentação ainda</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Cria um quadro tático com fotos dos jogadores, texto e formas.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova apresentação
          </Button>
        </div>
      )}

      {!isLoading && boards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board, i) => (
            <motion.div
              key={board.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative rounded-lg border bg-card hover:border-primary/50 transition-colors"
            >
              <Link href={`/boards/${board.id}`} className="block p-5">
                <div
                  className="h-28 rounded-md mb-3 flex items-center justify-center"
                  style={{ background: "#1e293b" }}
                >
                  <LayoutPanelLeft className="h-8 w-8 text-slate-500" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{board.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(board.updatedAt).toLocaleDateString("pt-PT")}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setDeleteId(board.id);
                }}
                className="absolute top-2 right-2 h-7 w-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/10 hover:bg-destructive/20 text-destructive"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova apresentação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="py-2">
              <Label htmlFor="board-name">Nome</Label>
              <Input
                id="board-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Análise adversário, Rotações serviço…"
                className="mt-1.5"
                autoFocus
              />
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar apresentação?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível. Todos os slides serão eliminados.
          </p>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
