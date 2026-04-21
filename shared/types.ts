/**
 * Enums partilhados entre client e server. Mantidos como `as const` arrays
 * para poderem ser usados em Zod (`z.enum`) e em componentes de UI (iteração).
 */

export const ACTION_TYPES = [
  "serve",
  "reception",
  "set",
  "attack",
  "block",
  "dig",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_RESULTS = [
  "kill",       // ponto ganho em ataque
  "error",      // erro próprio
  "ace",        // serviço direto
  "tooled",     // ataque que toca no bloco e sai
  "in_play",    // bola continua
  "perfect",    // passe/defesa perfeito (para reception/dig)
  "good",       // passe/defesa bom
  "poor",       // passe/defesa fraco
  "blocked",    // ataque bloqueado pelo adversário
  "stuff",      // bloco que pontua
  "touch",      // bloco de toque / defesa com desvio
] as const;
export type ActionResult = (typeof ACTION_RESULTS)[number];

export const POSITIONS = [
  "OH",   // outside hitter
  "OPP",  // opposite
  "MB",   // middle blocker
  "S",    // setter
  "L",    // libero
  "DS",   // defensive specialist
] as const;
export type Position = (typeof POSITIONS)[number];

/** Zonas 1–9 do campo (padrão internacional de scouting). */
export const ZONES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type Zone = (typeof ZONES)[number];

/**
 * Mapa zone → coluna/linha no grid 3x3 (do ponto de vista do lado observado,
 * com a rede em cima). Usado pelo componente <Court> para posicionar as
 * zonas numeradas.
 *
 *   col:  0    1    2
 *   row 0 [ 4 ][ 3 ][ 2 ]   ← linha da frente (junto à rede)
 *   row 1 [ 7 ][ 8 ][ 9 ]   ← meio-campo
 *   row 2 [ 5 ][ 6 ][ 1 ]   ← fundo
 */
export const ZONE_GRID: Record<Zone, { col: number; row: number }> = {
  4: { col: 0, row: 0 },
  3: { col: 1, row: 0 },
  2: { col: 2, row: 0 },
  7: { col: 0, row: 1 },
  8: { col: 1, row: 1 },
  9: { col: 2, row: 1 },
  5: { col: 0, row: 2 },
  6: { col: 1, row: 2 },
  1: { col: 2, row: 2 },
};

/**
 * Resultados aplicáveis a cada tipo de acção.
 * Por exemplo, um "kill" só faz sentido num "attack", um "ace" num "serve".
 * Usado pelo scout para mostrar os botões certos em cada passo.
 */
export const RESULTS_BY_ACTION: Record<ActionType, readonly ActionResult[]> = {
  serve: ["ace", "error", "in_play"],
  reception: ["perfect", "good", "poor", "error"],
  set: ["perfect", "good", "poor", "error"],
  attack: ["kill", "error", "tooled", "blocked", "in_play"],
  block: ["stuff", "touch", "error", "in_play"],
  dig: ["perfect", "good", "poor", "error"],
};

/** Classe Tailwind para cada resultado — mantém coerência cross-components. */
export const RESULT_COLOR: Record<ActionResult, string> = {
  kill: "bg-emerald-600 text-white hover:bg-emerald-600/90",
  ace: "bg-sky-600 text-white hover:bg-sky-600/90",
  stuff: "bg-emerald-600 text-white hover:bg-emerald-600/90",
  perfect: "bg-emerald-600 text-white hover:bg-emerald-600/90",
  good: "bg-sky-600 text-white hover:bg-sky-600/90",
  in_play: "bg-slate-500 text-white hover:bg-slate-500/90",
  touch: "bg-slate-500 text-white hover:bg-slate-500/90",
  tooled: "bg-amber-500 text-white hover:bg-amber-500/90",
  poor: "bg-amber-500 text-white hover:bg-amber-500/90",
  blocked: "bg-red-600 text-white hover:bg-red-600/90",
  error: "bg-red-600 text-white hover:bg-red-600/90",
};

/** Label amigável (PT) de cada resultado. */
export const RESULT_LABEL: Record<ActionResult, string> = {
  kill: "Kill",
  error: "Erro",
  ace: "Ace",
  tooled: "Tooled",
  in_play: "Em jogo",
  perfect: "Perfeito",
  good: "Bom",
  poor: "Fraco",
  blocked: "Bloqueado",
  stuff: "Stuff",
  touch: "Toque",
};

export const ACTION_LABEL: Record<ActionType, string> = {
  serve: "Serviço",
  reception: "Recepção",
  set: "Distribuição",
  attack: "Ataque",
  block: "Bloco",
  dig: "Defesa",
};

export const PLANS = ["basic", "pro", "club"] as const;
export type Plan = (typeof PLANS)[number];

export const CHECKLIST_CATEGORIES = [
  "lineup",
  "scouting",
  "tactical",
  "logistics",
] as const;
export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

export const TRAINING_PRIORITIES = ["high", "medium", "low"] as const;
export type TrainingPriority = (typeof TRAINING_PRIORITIES)[number];

/** Payload que o backend envia ao Claude para Pattern Detection. */
export interface PatternDetectionInput {
  teamId: string;
  opponent: string;
  sampleSize: number; // nº de acções usadas
  serveTargets: Record<string, number>;        // zona → count
  attackByRotation: Record<string, Record<string, number>>; // rotation → zone → count
  rotationSideOut: Record<string, number>;     // rotation → side-out %
  setterDistribution: Record<string, number>;  // posição → count
}

/** Output esperado do Claude (validado por Zod no server). */
export interface DetectedPattern {
  id: string;
  title: string;
  category: "serve" | "attack" | "rotation" | "setter" | "reception";
  confidence: number; // 0-100
  evidence: string;
  recommendation: string;
}
