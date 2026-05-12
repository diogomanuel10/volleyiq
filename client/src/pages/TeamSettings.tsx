import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, RefreshCw, Users, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useTeam } from "@/hooks/useTeam";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Team } from "@shared/schema";

interface Membership {
  id: string;
  teamId: string;
  uid: string;
  role: "owner" | "coach" | "analyst" | "viewer";
}

const ROLE_LABEL: Record<Membership["role"], string> = {
  owner: "Dono",
  coach: "Treinador",
  analyst: "Analista",
  viewer: "Observador",
};

export default function TeamSettings() {
  const { team } = useTeam();

  if (!team) return null;

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Definições da equipa
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {team.name} · {team.club}
        </p>
      </header>

      <InviteCodeCard team={team} />
      <MembersCard teamId={team.id} />
    </div>
  );
}

function InviteCodeCard({ team }: { team: Team }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const code = (team as any).inviteCode as string | null;

  const regenMutation = useMutation({
    mutationFn: () =>
      api.post<{ inviteCode: string }>(`/api/teams/${team.id}/regenerate-invite`, {}),
    onSuccess: () => {
      toast.success("Código regenerado.");
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err: any) => {
      if (err?.message?.includes("owner_only")) {
        toast.error("Só o dono da equipa pode regenerar o código.");
      } else {
        toast.error("Não foi possível regenerar o código.");
      }
    },
  });

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Código de convite</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Partilha este código com o teu assistente. Ele introduz-o em{" "}
          <strong>Juntar equipa</strong> para ter acesso imediato.
        </p>
      </div>

      {code ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-lg border bg-muted px-4 py-3 font-mono text-2xl tracking-[0.3em] font-bold text-center select-all">
            {code}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={copyCode}
            title="Copiar código"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (confirm("Regenerar código? O código anterior deixa de funcionar."))
                regenMutation.mutate();
            }}
            disabled={regenMutation.isPending}
            title="Regenerar código"
          >
            <RefreshCw
              className={`h-4 w-4 ${regenMutation.isPending ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground flex-1">
            Esta equipa ainda não tem código de convite.
          </p>
          <Button
            variant="outline"
            onClick={() => regenMutation.mutate()}
            disabled={regenMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Gerar código
          </Button>
        </div>
      )}
    </section>
  );
}

function MembersCard({ teamId }: { teamId: string }) {
  const membersQuery = useQuery<Membership[]>({
    queryKey: ["teamMembers", teamId],
    queryFn: () => api.get(`/api/teams/${teamId}/members`),
  });

  const members = membersQuery.data ?? [];

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Membros</h2>
        {members.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {members.length} {members.length === 1 ? "membro" : "membros"}
          </span>
        )}
      </div>

      {membersQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sem membros registados.
        </p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                {m.uid}
              </span>
              <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                {ROLE_LABEL[m.role]}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Os membros entram como <strong>Treinador</strong> por omissão. Em breve
        será possível alterar os roles aqui.
      </p>
    </section>
  );
}
