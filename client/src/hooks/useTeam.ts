import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Team } from "@shared/schema";

const STORAGE_KEY = "volleyiq:teamId";

/**
 * Gere o "team atual" do utilizador. Persiste a selecção em localStorage.
 * Se o utilizador ainda não tem equipa nenhuma, devolve `team: null` —
 * cabe ao caller encaminhar para o ecrã de onboarding.
 */
export function useTeam() {
  const qc = useQueryClient();

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => api.get<Team[]>("/api/teams"),
  });

  const stored =
    typeof window !== "undefined"
      ? window.localStorage.getItem(STORAGE_KEY)
      : null;

  const teams = teamsQuery.data ?? [];
  const current = teams.find((t) => t.id === stored) ?? teams[0] ?? null;

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
    hasTeams: teams.length > 0,
    setTeam,
  };
}
