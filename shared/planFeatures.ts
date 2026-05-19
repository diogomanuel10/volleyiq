import type { Plan } from "./types";

export interface PlanLimits {
  maxTeams: number;          // -1 = ilimitado
  maxMatchesPerTeam: number; // -1 = ilimitado
  maxPdfsPerMonth: number;   // -1 = ilimitado
  opponents: boolean;
  scenarioModeling: boolean;
  fullAnalytics: boolean;
  exportCsv: boolean;
  aiPatterns: boolean;
  aiTrainingPlans: boolean;
  aiLiveSuggestions: boolean;
  clubDashboard: boolean;
  customBranding: boolean;
}

export const PLAN_FEATURES: Record<Plan, PlanLimits> = {
  // Plano individual — 1 equipa, sem IA, sem adversários
  individual: {
    maxTeams: 1,
    maxMatchesPerTeam: 20,
    maxPdfsPerMonth: 3,
    opponents: false,
    scenarioModeling: false,
    fullAnalytics: true,
    exportCsv: false,
    aiPatterns: false,
    aiTrainingPlans: false,
    aiLiveSuggestions: false,
    clubDashboard: false,
    customBranding: false,
  },
  // Alias de basic → mesmo que individual (retrocompatibilidade)
  basic: {
    maxTeams: 1,
    maxMatchesPerTeam: 20,
    maxPdfsPerMonth: 3,
    opponents: false,
    scenarioModeling: false,
    fullAnalytics: true,
    exportCsv: false,
    aiPatterns: false,
    aiTrainingPlans: false,
    aiLiveSuggestions: false,
    clubDashboard: false,
    customBranding: false,
  },
  // Pro — 5 equipas, adversários, analytics, AI patterns
  pro: {
    maxTeams: 5,
    maxMatchesPerTeam: -1,
    maxPdfsPerMonth: -1,
    opponents: true,
    scenarioModeling: true,
    fullAnalytics: true,
    exportCsv: true,
    aiPatterns: true,
    aiTrainingPlans: false,
    aiLiveSuggestions: false,
    clubDashboard: false,
    customBranding: false,
  },
  // Club — tudo ilimitado + IA completa
  club: {
    maxTeams: -1,
    maxMatchesPerTeam: -1,
    maxPdfsPerMonth: -1,
    opponents: true,
    scenarioModeling: true,
    fullAnalytics: true,
    exportCsv: true,
    aiPatterns: true,
    aiTrainingPlans: true,
    aiLiveSuggestions: true,
    clubDashboard: true,
    customBranding: true,
  },
};

export function planHasFeature(plan: Plan, feature: keyof PlanLimits): boolean {
  const limits = PLAN_FEATURES[plan] ?? PLAN_FEATURES["individual"];
  const val = limits[feature];
  return typeof val === "boolean" ? val : (val as number) !== 0;
}

/** Ordem dos planos para comparações de "mínimo plano necessário". */
const PLAN_ORDER: Plan[] = ["individual", "basic", "pro", "club"];

export function planMeetsMinimum(plan: Plan, minimum: Plan): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(minimum);
}

export const PLAN_LABELS: Record<Plan, string> = {
  individual: "Individual",
  basic: "Individual",
  pro: "Pro",
  club: "Club",
};

export const PLAN_UPGRADE_LABEL: Record<Plan, string> = {
  individual: "Fazer upgrade para Pro",
  basic: "Fazer upgrade para Pro",
  pro: "Fazer upgrade para Club",
  club: "",
};
