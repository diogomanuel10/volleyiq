import { useTeam } from "@/hooks/useTeam";
import { PLAN_FEATURES, planMeetsMinimum } from "@shared/planFeatures";
import type { Plan } from "@shared/types";
import type { PlanLimits } from "@shared/planFeatures";

export function usePlanGuard() {
  const { team, isSubscribed, isTrialExpired } = useTeam();
  const onTrial = !isSubscribed && !isTrialExpired && Boolean(team);
  // Durante o trial o utilizador tem acesso total (equivalente a Club).
  const plan: Plan = onTrial ? "club" : ((team?.plan ?? "individual") as Plan);
  const features = PLAN_FEATURES[plan];

  function can(feature: keyof PlanLimits): boolean {
    const val = features[feature];
    return typeof val === "boolean" ? val : (val as number) !== 0;
  }

  function meetsMinimum(minimum: Plan): boolean {
    return planMeetsMinimum(plan, minimum);
  }

  return { plan, features, can, meetsMinimum };
}
