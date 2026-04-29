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

export type DvCode = "#" | "+" | "-" | "/" | "!" | "=";

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

/** Código DataVolley para cada (tipo de acção, resultado). */
export const RESULT_DV_CODE: Record<
  ActionType,
  Partial<Record<ActionResult, DvCode>>
> = {
  // SERVIÇO (S)
  // DV avalia pela qualidade da receção adversária; com os resultados que tens:
  // - ace      → ponto directo  (#)
  // - error    → erro de serviço (=)
  // - in_play  → serviço neutro/positivo (+)
  serve: {
    ace: "#",
    error: "=",
    in_play: "+",
  },

  // RECEÇÃO (R)
  // Clássico DV: # perfeita, + boa, - má, = erro.
  reception: {
    perfect: "#",
    good: "+",
    poor: "-",
    error: "=",
  },

  // PASSE / DISTRIBUIÇÃO (E)
  // Mesma lógica da receção.
  set: {
    perfect: "#",
    good: "+",
    poor: "-",
    error: "=",
  },

  // ATAQUE (A)
  // # kill, / tooled (block-out), ! continuidade neutra, - ataque negativo,
  // = erro.
  attack: {
    kill: "#",
    tooled: "/",
    in_play: "!",
    blocked: "-",
    error: "=",
  },

  // BLOCO (B)
  // # stuff (ponto directo), + bom toque, ! continuidade neutra, = erro.
  block: {
    stuff: "#",
    touch: "+",
    in_play: "!",
    error: "=",
  },

  // DEFESA (D / dig)
  // Igual à receção: # perfeita, + boa, - má, = erro.
  dig: {
    perfect: "#",
    good: "+",
    poor: "-",
    error: "=",
  },
};

export function getResultByDv(
  actionType: ActionType,
  dv: DvCode
): ActionResult | null {
  const entries = Object.entries(RESULT_DV_CODE[actionType]) as Array<
    [ActionResult, DvCode]
  >;

  const found = entries.find(([, code]) => code === dv);
  return found ? found[0] : null;
}

export function getDvCode(
  actionType: ActionType,
  result: ActionResult
): DvCode | null {
  return RESULT_DV_CODE[actionType][result] ?? null;
}

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

/** Input para recomendações de treino por jogadora. */
export interface TrainingRecommendationInput {
  playerId: string;
  firstName: string;
  lastName: string;
  position: Position;
  sampleActions: number;
  kpis: {
    killPct: number;
    attackEff: number;
    passRating: number;
    serveAcePct: number;
    blocks: number;
    digs: number;
  };
  weaknesses: string[]; // lista de áreas fracas detectadas
}

export const TRAINING_FOCI = [
  "serve",
  "attack",
  "reception",
  "block",
  "defense",
  "setting",
] as const;
export type TrainingFocus = (typeof TRAINING_FOCI)[number];

/** Forma final (cacheada em `training_logs.recJson`). */
export interface TrainingRecommendation {
  title: string;
  focus: TrainingFocus;
  priority: TrainingPriority;
  rationale: string;
  drills: Array<{ name: string; durationMin: number; description: string }>;
}
