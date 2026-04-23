import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logout } from "@/lib/firebase";
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
  const [form, setForm] = useState<FormState>(INITIAL);
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
    if (
      !form.name.trim() ||
      !form.club.trim() ||
      !form.category.trim()
    ) {
      toast.error("Preenche nome da equipa, clube e escalão.");
      return;
    }
    mutation.mutate(form);
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4 md:p-8 bg-background">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Bem-vindo ao VolleyIQ
          </h1>
          <p className="mt-2 text-muted-foreground">
            Vamos começar por criar a tua equipa. Podes editar estes dados
            mais tarde.
          </p>
        </div>

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
              placeholder="Ex: Seniores Femininas, Sub-18 M, Juvenis…"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              disabled={mutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Texto livre — usa a nomenclatura que preferires.
            </p>
          </div>

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

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              disabled={mutation.isPending}
            >
              Sair
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="sm:min-w-[180px]"
            >
              {mutation.isPending ? "A criar…" : "Criar equipa"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
