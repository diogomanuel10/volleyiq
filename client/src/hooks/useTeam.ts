import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Team } from "@shared/schema";

const STORAGE_KEY = "volleyiq:teamId";

/**
 * Gere o "team atual" do utilizador. Persiste em localStorage e, caso o
 * utilizador ainda não tenha equipa nenhuma (primeiro login em dev), chama
 * `/teams/bootstrap` para criar uma com roster demo.
 */
export function useTeam() {
  const qc = useQueryClient();

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      let list = await api.get<Team[]>("/api/teams");
      if (list.length === 0) {
        await api.post<Team>("/api/teams/bootstrap", {});
        list = await api.get<Team[]>("/api/teams");
      }
      return list;
    },
  });

  const stored =
    typeof window !== "undefined"
      ? window.localStorage.getItem(STORAGE_KEY)
      : null;

  const teams = teamsQuery.data ?? [];
  const current =
    teams.find((t) => t.id === stored) ?? teams[0] ?? null;

  // Sincroniza localStorage quando a selecção muda (ex: equipa apagada).
  useEffect(() => {
    if (current && current.id !== stored) {
      window.localStorage.setItem(STORAGE_KEY, current.id);
    }
  }, [current, stored]);

  function setTeam(id: string) {
    window.localStorage.setItem(STORAGE_KEY, id);
    qc.invalidateQueries();
  }

  return {
    teams,
    team: current,
    isLoading: teamsQuery.isLoading,
    setTeam,
  };
}
