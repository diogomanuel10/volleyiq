import { ChevronDown, Check, Plus, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Team } from "@shared/schema";

interface Props {
  collapsed?: boolean;
}

export function TeamSwitcher({ collapsed = false }: Props) {
  const { teams, team, setTeam, isLoading } = useTeam();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (isLoading) {
    return <div className="h-9 rounded-md bg-muted animate-pulse" />;
  }
  if (!team) return null;

  const initials = team.name.slice(0, 2).toUpperCase();

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          title={collapsed ? team.name : undefined}
          className={cn(
            "w-full flex items-center rounded-md border bg-background text-sm hover:bg-accent transition-colors",
            collapsed ? "justify-center h-9" : "justify-between gap-2 px-3 h-9",
          )}
        >
          <div className={cn("flex items-center min-w-0", collapsed ? "" : "gap-2")}>
            <div
              className="h-6 w-6 rounded-md bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0"
              style={team.primaryColor ? { backgroundColor: team.primaryColor + "22", color: team.primaryColor } : {}}
            >
              {initials}
            </div>
            {!collapsed && <span className="truncate">{team.name}</span>}
          </div>
          {!collapsed && (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {open && (
          <div
            className={cn(
              "absolute z-30 top-full mt-1 rounded-md border bg-card text-card-foreground shadow-md py-1",
              collapsed ? "left-full ml-1 min-w-[200px]" : "left-0 right-0",
            )}
          >
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTeam(t.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-accent",
                  t.id === team.id && "font-medium",
                )}
              >
                <span className="truncate">{t.name}</span>
                {t.id === team.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
            <div className="border-t mt-1 pt-1">
              <button
                onClick={() => { setOpen(false); setCreateOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nova equipa
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateTeamDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(newTeam) => {
          setTeam(newTeam.id);
          setCreateOpen(false);
        }}
      />
    </>
  );
}

function CreateTeamDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (team: Team) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [category, setCategory] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.post<Team>("/api/teams", { name, club, category }),
    onSuccess: (newTeam) => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Equipa criada!");
      setName(""); setClub(""); setCategory("");
      onCreated(newTeam);
    },
    onError: (err: any) => {
      const code = err?.body?.error;
      if (code === "plan_limit_teams") {
        toast.error("Atingiste o limite de equipas do teu plano. Faz upgrade para criar mais.");
      } else {
        toast.error("Não foi possível criar a equipa.");
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !club.trim() || !category.trim()) {
      toast.error("Preenche nome, clube e escalão.");
      return;
    }
    create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova equipa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="new-team-name">Nome da equipa</Label>
            <Input
              id="new-team-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: VolleyIQ Seniores B"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-team-club">Clube</Label>
            <Input
              id="new-team-club"
              required
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="Ex: CD Volley Lisboa"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-team-category">Escalão</Label>
            <Input
              id="new-team-category"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Sub-18 Femininas"
            />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> A criar…</>
              : "Criar equipa →"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
