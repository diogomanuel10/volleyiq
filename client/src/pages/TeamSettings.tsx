import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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

export default function TeamSettings() {
  const { team } = useTeam();
  const { t } = useTranslation();

  if (!team) return null;

  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {t("teamSettings.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("teamSettings.subtitle", { name: team.name, club: team.club })}
        </p>
      </header>

      <InviteCodeCard team={team} />
      <MembersCard teamId={team.id} />
    </div>
  );
}

function InviteCodeCard({ team }: { team: Team }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const code = (team as any).inviteCode as string | null;

  const regenMutation = useMutation({
    mutationFn: () =>
      api.post<{ inviteCode: string }>(`/api/teams/${team.id}/regenerate-invite`, {}),
    onSuccess: () => {
      toast.success(t("teamSettings.inviteCode.regenerated"));
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err: any) => {
      if (err?.message?.includes("owner_only")) {
        toast.error(t("teamSettings.inviteCode.ownerOnly"));
      } else {
        toast.error(t("teamSettings.inviteCode.regenerateError"));
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
        <h2 className="font-semibold">{t("teamSettings.inviteCode.title")}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("teamSettings.inviteCode.description")}
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
            title={t("teamSettings.inviteCode.copyCode")}
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
              if (confirm(t("teamSettings.inviteCode.regenerateConfirm")))
                regenMutation.mutate();
            }}
            disabled={regenMutation.isPending}
            title={t("teamSettings.inviteCode.regenerateCode")}
          >
            <RefreshCw
              className={`h-4 w-4 ${regenMutation.isPending ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground flex-1">
            {t("teamSettings.inviteCode.noCode")}
          </p>
          <Button
            variant="outline"
            onClick={() => regenMutation.mutate()}
            disabled={regenMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            {t("teamSettings.inviteCode.generateCode")}
          </Button>
        </div>
      )}
    </section>
  );
}

function MembersCard({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const membersQuery = useQuery<Membership[]>({
    queryKey: ["teamMembers", teamId],
    queryFn: () => api.get(`/api/teams/${teamId}/members`),
  });

  const members = membersQuery.data ?? [];

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">{t("teamSettings.members.title")}</h2>
        {members.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {t("teamSettings.members.count", { count: members.length })}
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
          {t("teamSettings.members.empty")}
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
                {t(`teamSettings.members.roles.${m.role}`)}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        {t("teamSettings.members.rolesNote")}
      </p>
    </section>
  );
}
