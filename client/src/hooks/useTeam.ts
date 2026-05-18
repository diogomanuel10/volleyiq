import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Team } from "@shared/schema";

const STORAGE_KEY = "volleyiq:teamId";

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

  function trialDaysLeft(): number {
    if (!current?.trialEndsAt) return 0;
    const ms = new Date(current.trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  const isSubscribed = Boolean(current?.subscribedAt);
  const daysLeft = trialDaysLeft();
  const isTrialExpired = !isSubscribed && daysLeft === 0 && Boolean(current);

  return {
    teams,
    team: current,
    isLoading: teamsQuery.isLoading,
    hasTeams: teams.length > 0,
    setTeam,
    isSubscribed,
    trialDaysLeft: daysLeft,
    isTrialExpired,
  };
}
