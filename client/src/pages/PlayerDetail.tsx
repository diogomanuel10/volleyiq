import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Player } from "@shared/schema";

const POSITION_LABEL: Record<string, string> = {
  OH: "Ponta (Outside Hitter)",
  OPP: "Oposto (Opposite)",
  MB: "Central (Middle Blocker)",
  S: "Distribuidor (Setter)",
  L: "Líbero",
  DS: "Defensivo (Defensive Specialist)",
};

export default function PlayerDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { team } = useTeam();

  const playerQuery = useQuery({
    queryKey: ["player", team?.id, params.id],
    queryFn: () =>
      api.get<Player>(`/api/players/${params.id}?teamId=${team!.id}`),
    enabled: !!team && !!params.id,
  });

  if (!team) return null;

  const player = playerQuery.data;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/players")}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      {playerQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !player ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Jogadora não encontrada.{" "}
            <Link href="/players" className="text-primary hover:underline">
              Voltar ao roster
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-6 flex flex-wrap items-center gap-5">
              <Avatar className="h-20 w-20 text-xl">
                <AvatarFallback>
                  {player.firstName[0]}
                  {player.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-[200px]">
                <div className="text-2xl font-bold">
                  {player.firstName} {player.lastName}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Badge variant="secondary">#{player.number}</Badge>
                  <span>{POSITION_LABEL[player.position]}</span>
                  {player.heightCm && <span>· {player.heightCm} cm</span>}
                  {!player.active && (
                    <Badge variant="outline">Inactiva</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "Kill %", value: "—", hint: "aguarda jogos scouted" },
              { label: "Pass Rating", value: "—", hint: "aguarda recepções" },
              { label: "Block pts", value: "—", hint: "aguarda dados" },
            ].map((k) => (
              <Card key={k.label}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                  <div className="text-2xl font-bold mt-1">{k.value}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {k.hint}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Recomendações de treino (IA)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              As recomendações são geradas a partir dos padrões detectados nos
              jogos scouted. Esta secção vai ligar ao endpoint{" "}
              <code>/api/ai/training</code> na Fase 4.
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
