import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logout } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import type { Team } from "@shared/schema";

interface FormState {
  name: string;
  club: string;
  category: string;
  season: string;
  division: string;
  primaryColor: string;
}

const INITIAL: FormState = {
  name: "",
  club: "",
  category: "",
  season: "",
  division: "",
  primaryColor: "#0ea5e9",
};

export default function Onboarding() {
  const [mode, setMode] = useState<"create" | "join">("create");

  return (
    <div className="min-h-full flex items-center justify-center p-4 md:p-8 bg-background">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Bem-vindo ao VolleyIQ
          </h1>
          <p className="mt-2 text-muted-foreground">
            Cria a tua equipa ou junta-te a uma existente.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg border overflow-hidden">
          <button
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              mode === "create"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-muted-foreground",
            )}
            onClick={() => setMode("create")}
          >
            Criar equipa
          </button>
          <button
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              mode === "join"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-muted-foreground",
            )}
            onClick={() => setMode("join")}
          >
            Tenho um código
          </button>
        </div>

        {mode === "create" ? <CreateTeamForm /> : <JoinTeamForm />}

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateTeamForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [showOptional, setShowOptional] = useState(false);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: FormState) =>
      api.post<Team>("/api/teams", {
        name: data.name.trim(),
        club: data.club.trim(),
        category: data.category.trim(),
        season: data.season.trim() || null,
        division: data.division.trim() || null,
        primaryColor: data.primaryColor || null,
      }),
    onSuccess: () => {
      toast.success("Equipa criada!");
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err) => {
      toast.error("Não foi possível criar a equipa", {
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.club.trim() || !form.category.trim()) {
      toast.error("Preenche nome da equipa, clube e escalão.");
      return;
    }
    mutation.mutate(form);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border bg-card p-6 md:p-8 space-y-5 shadow-sm"
    >
      <div className="grid gap-2">
        <Label htmlFor="name">
          Nome da equipa <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          autoFocus
          required
          placeholder="Ex: VolleyIQ Seniores A"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          disabled={mutation.isPending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="club">
          Clube <span className="text-destructive">*</span>
        </Label>
        <Input
          id="club"
          required
          placeholder="Ex: CD Volley Lisboa"
          value={form.club}
          onChange={(e) => update("club", e.target.value)}
          disabled={mutation.isPending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category">
          Escalão <span className="text-destructive">*</span>
        </Label>
        <Input
          id="category"
          required
          placeholder="Ex: Seniores Femininas, Sub-18 M…"
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
          disabled={mutation.isPending}
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              showOptional && "rotate-180",
            )}
          />
          Detalhes opcionais (época, divisão, cor)
        </button>

        {showOptional && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="season">Época</Label>
                <Input
                  id="season"
                  placeholder="Ex: 2025/26"
                  value={form.season}
                  onChange={(e) => update("season", e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="division">Divisão</Label>
                <Input
                  id="division"
                  placeholder="Ex: Divisão A1"
                  value={form.division}
                  onChange={(e) => update("division", e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="primaryColor">Cor principal</Label>
              <div className="flex items-center gap-3">
                <input
                  id="primaryColor"
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => update("primaryColor", e.target.value)}
                  disabled={mutation.isPending}
                  className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
                  aria-label="Selector de cor principal"
                />
                <Input
                  value={form.primaryColor}
                  onChange={(e) => update("primaryColor", e.target.value)}
                  disabled={mutation.isPending}
                  placeholder="#0ea5e9"
                  className="max-w-[140px] font-mono"
                />
                <div
                  aria-hidden
                  className="h-10 flex-1 rounded-md border"
                  style={{ backgroundColor: form.primaryColor }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={mutation.isPending}
        className="w-full"
      >
        {mutation.isPending ? "A criar…" : "Criar equipa →"}
      </Button>
    </form>
  );
}

function JoinTeamForm() {
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const qc = useQueryClient();

  const normalized = code.trim().toUpperCase();

  const previewQuery = useQuery<{ id: string; name: string; club: string; category: string } | null>({
    queryKey: ["teamPreview", normalized],
    queryFn: async () => {
      if (normalized.length < 6) return null;
      try {
        return await api.get(`/api/teams/join/${normalized}`);
      } catch {
        return null;
      }
    },
    enabled: normalized.length === 6,
    staleTime: 30_000,
  });

  const joinMutation = useMutation({
    mutationFn: () => api.post<Team>("/api/teams/join", { code: normalized }),
    onSuccess: () => {
      toast.success("Juntaste-te à equipa!");
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err: any) => {
      const msg = err?.message ?? "";
      if (msg.includes("already_member")) {
        toast.error("Já és membro desta equipa.");
      } else {
        toast.error("Código inválido ou expirado.");
      }
    },
  });

  const teamInfo = previewQuery.data;
  const codeOk = normalized.length === 6 && teamInfo != null;

  return (
    <div className="rounded-xl border bg-card p-6 md:p-8 space-y-5 shadow-sm">
      <div className="space-y-1">
        <Label htmlFor="invite-code">Código da equipa</Label>
        <p className="text-xs text-muted-foreground">
          Pede o código de 6 letras ao treinador principal.
        </p>
      </div>

      <Input
        id="invite-code"
        autoFocus
        placeholder="Ex: ABC123"
        value={code}
        onChange={(e) => {
          setCode(e.target.value.toUpperCase().slice(0, 6));
          setConfirmed(false);
        }}
        className="font-mono text-lg tracking-widest text-center"
        maxLength={6}
      />

      {normalized.length === 6 && (
        <>
          {previewQuery.isLoading && (
            <p className="text-xs text-muted-foreground text-center">A verificar código…</p>
          )}
          {!previewQuery.isLoading && teamInfo && (
            <div className="rounded-lg border bg-muted/40 p-4 flex items-start gap-3">
              <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">{teamInfo.name}</p>
                <p className="text-xs text-muted-foreground">
                  {teamInfo.club} · {teamInfo.category}
                </p>
              </div>
            </div>
          )}
          {!previewQuery.isLoading && !teamInfo && (
            <p className="text-xs text-destructive text-center">
              Código não encontrado. Verifica com o teu treinador.
            </p>
          )}
        </>
      )}

      <Button
        className="w-full"
        disabled={!codeOk || joinMutation.isPending}
        onClick={() => joinMutation.mutate()}
      >
        {joinMutation.isPending ? "A juntar…" : "Juntar à equipa →"}
      </Button>
    </div>
  );
}
