import { useReducer } from "react";
import { nanoid } from "nanoid";
import type { ActionResult, ActionType, Zone } from "@shared/types";
import type { ScoutMode } from "@/lib/scoutMode";

/**
 * Estado de scouting em memória. Cada registo final é também persistido
 * em `/api/actions`; este hook apenas orquestra o fluxo de seleção.
 *
 * Modo `lite`     → player → action → zone (opcional)  → result
 * Modo `complete` → player → action → zoneFrom         → zoneTo → result
 *
 * Em modo `complete`, `zoneFrom` é também o início da seta de trajectória
 * desenhada no Court. A próxima acção sugerida é computada por
 * `deriveSuggestion` com base na última acção guardada + regras do fluxo.
 */

export interface LoggedAction {
  id: string;
  playerId: string;
  type: ActionType;
  zoneFrom: Zone | null;
  zoneTo: Zone | null;
  /** Coordenadas precisas em % do SVG do Court (0..100). Opcionais — caem
   * no centro da zona quando não existem (ex: selecção por teclado). */
  zoneFromX?: number | null;
  zoneFromY?: number | null;
  zoneToX?: number | null;
  zoneToY?: number | null;
  result: ActionResult;
  rallyId: string;
  rotation: number;
  setNumber: number;
  timestamp: number;
  /**
   * Estado de saque/rotação ANTES desta acção. Usado para restaurar em undo
   * sem ter de recomputar a partir do log inteiro. Best-effort em hidratação
   * (acções carregadas da API não trazem este campo).
   */
  prevServingTeam?: Side;
  prevRotation?: number;
}

export type Step =
  | "idle"
  | "player"
  | "action"
  | "zoneFrom"
  | "zoneTo"
  // Passo legado: "zone" mantido para o modo lite (= destino único opcional).
  | "zone"
  | "result";

export type Side = "home" | "away";

export interface ScoutState {
  mode: ScoutMode;
  step: Step;
  playerId: string | null;
  actionType: ActionType | null;
  zoneFrom: Zone | null;
  zoneTo: Zone | null;
  /** Coordenadas precisas (% do SVG, 0..100) da origem e destino. */
  zoneFromX: number | null;
  zoneFromY: number | null;
  zoneToX: number | null;
  zoneToY: number | null;
  setNumber: number;
  rotation: number;
  homeScore: number;
  awayScore: number;
  /** Quem está actualmente a servir. */
  servingTeam: Side;
  rallyId: string;
  log: LoggedAction[];
}

type ScoutEvent =
  | { kind: "selectPlayer"; playerId: string }
  | { kind: "selectAction"; actionType: ActionType }
  | { kind: "selectZoneFrom"; zone: Zone; x?: number; y?: number }
  | { kind: "selectZoneTo"; zone: Zone; x?: number; y?: number }
  | { kind: "selectZone"; zone: Zone; x?: number; y?: number } // lite legacy
  | { kind: "skipZone" } // lite legacy
  | { kind: "selectResult"; result: ActionResult }
  | { kind: "undo" }
  | { kind: "reset" }
  | { kind: "setMode"; mode: ScoutMode }
  | { kind: "adjustScore"; side: Side; delta: 1 | -1 }
  | { kind: "rotate"; direction: 1 | -1 }
  | { kind: "setServingTeam"; team: Side }
  | { kind: "nextSet" }
  | { kind: "prevSet" }
  | { kind: "hydrate"; actions: LoggedAction[] }
  | { kind: "quickPoint"; winner: "home" | "away" }
  | {
      kind: "hydrateSession";
      actions: LoggedAction[];
      homeScore: number;
      awayScore: number;
      setNumber: number;
      rotation: number;
      servingTeam: Side;
    };

const initial: ScoutState = {
  mode: "lite",
  step: "idle",
  playerId: null,
  actionType: null,
  zoneFrom: null,
  zoneTo: null,
  zoneFromX: null,
  zoneFromY: null,
  zoneToX: null,
  zoneToY: null,
  setNumber: 1,
  rotation: 1,
  homeScore: 0,
  awayScore: 0,
  servingTeam: "home",
  rallyId: nanoid(8),
  log: [],
};

const TERMINAL_RESULTS = new Set<ActionResult>([
  "kill",
  "error",
  "ace",
  "blocked",
  "stuff",
  "won",
  "lost",
]);

/**
 * Regras simplificadas do fluxo: dada a última acção registada, qual é o
 * tipo de acção mais provável a seguir (para o nosso lado). Usado pela
 * ActionBar em modo complete para destacar o próximo passo.
 *
 * Quando o rally termina (resultado terminal), o próximo é sempre `serve`.
 * Se não há acção anterior (início do set), também `serve`.
 */
export function deriveSuggestion(log: LoggedAction[]): ActionType | null {
  const last = log[log.length - 1];
  if (!last) return "serve";
  if (TERMINAL_RESULTS.has(last.result)) return "serve";
  switch (last.type) {
    case "serve":
      // Bola voltou. Esperamos ataque adversário → defesa nossa.
      return "dig";
    case "reception":
      return "set";
    case "set":
      return "attack";
    case "attack":
      // Adversário defendeu ou bloqueou com toque → próximo é o nosso
      // bloco/defesa quando a bola volta.
      return "dig";
    case "dig":
      return "set";
    case "block":
      // Block com toque mantém o rally, a bola fica a pairar → set.
      return "set";
    default:
      return null;
  }
}

function reducer(s: ScoutState, e: ScoutEvent): ScoutState {
  switch (e.kind) {
    case "setMode": {
      // Se mudar de modo a meio de uma acção, reset do passo para idle para
      // não ficar inconsistente (ex: "zoneFrom" não existe em modo lite).
      if (s.mode === e.mode) return s;
      return {
        ...s,
        mode: e.mode,
        step: "idle",
        playerId: null,
        actionType: null,
        zoneFrom: null,
        zoneTo: null,
        zoneFromX: null,
        zoneFromY: null,
        zoneToX: null,
        zoneToY: null,
      };
    }
    case "selectPlayer":
      return { ...s, step: "action", playerId: e.playerId };
    case "selectAction": {
      // Lite: pula para zona opcional. Complete: pede primeiro zoneFrom.
      const nextStep: Step = s.mode === "complete" ? "zoneFrom" : "zone";
      return { ...s, step: nextStep, actionType: e.actionType };
    }
    case "selectZoneFrom":
      return {
        ...s,
        step: "zoneTo",
        zoneFrom: e.zone,
        zoneFromX: e.x ?? null,
        zoneFromY: e.y ?? null,
      };
    case "selectZoneTo":
      return {
        ...s,
        step: "result",
        zoneTo: e.zone,
        zoneToX: e.x ?? null,
        zoneToY: e.y ?? null,
      };
    // --- lite legacy ------------------------------------------------------
    case "selectZone":
      return {
        ...s,
        step: "result",
        zoneTo: e.zone,
        zoneToX: e.x ?? null,
        zoneToY: e.y ?? null,
      };
    case "skipZone":
      return { ...s, step: "result", zoneTo: null, zoneToX: null, zoneToY: null };
    // ---------------------------------------------------------------------
    case "selectResult": {
      if (!s.playerId || !s.actionType) return s;
      const logged: LoggedAction = {
        id: nanoid(12),
        playerId: s.playerId,
        type: s.actionType,
        zoneFrom: s.zoneFrom,
        zoneTo: s.zoneTo,
        zoneFromX: s.zoneFromX,
        zoneFromY: s.zoneFromY,
        zoneToX: s.zoneToX,
        zoneToY: s.zoneToY,
        result: e.result,
        rallyId: s.rallyId,
        rotation: s.rotation,
        setNumber: s.setNumber,
        timestamp: Date.now(),
        prevServingTeam: s.servingTeam,
        prevRotation: s.rotation,
      };
      const pointScored =
        (logged.type === "attack" && logged.result === "kill") ||
        (logged.type === "serve" && logged.result === "ace") ||
        (logged.type === "block" && logged.result === "stuff") ||
        (logged.type === "freeball" && logged.result === "won");
      const pointLost =
        logged.result === "error" ||
        (logged.type === "attack" && logged.result === "blocked") ||
        (logged.type === "freeball" && logged.result === "lost");

      // ── Side-out + auto-rotação ─────────────────────────────────────
      // Se este resultado terminar o rally, descobrimos o vencedor e —
      // se vencer quem não estava a servir — fazemos side-out e rotação.
      // Rotação só conta para nós (única lateralidade que rastreamos).
      const rallyEnded = TERMINAL_RESULTS.has(logged.result);
      let nextServingTeam = s.servingTeam;
      let nextRotation = s.rotation;
      if (rallyEnded) {
        const winner: Side = pointScored ? "home" : "away";
        if (winner !== s.servingTeam) {
          nextServingTeam = winner;
          if (winner === "home") {
            // Rotação volley = sentido horário: 1 → 6 → 5 → 4 → 3 → 2 → 1.
            // Cada jogador desce uma posição (P2 → P1, P3 → P2, …, P1 → P6).
            nextRotation = s.rotation === 1 ? 6 : s.rotation - 1;
          }
        }
      }

      return {
        ...s,
        step: "idle",
        playerId: null,
        actionType: null,
        zoneFrom: null,
        zoneTo: null,
        zoneFromX: null,
        zoneFromY: null,
        zoneToX: null,
        zoneToY: null,
        log: [...s.log, logged],
        rallyId: rallyEnded ? nanoid(8) : s.rallyId,
        homeScore: pointScored ? s.homeScore + 1 : s.homeScore,
        awayScore: pointLost ? s.awayScore + 1 : s.awayScore,
        servingTeam: nextServingTeam,
        rotation: nextRotation,
      };
    }
    case "quickPoint": {
      // Regista um ponto sem acção rastreada de jogador:
      //   winner === "home" → erro do adversário (nós marcamos)
      //   winner === "away" → mérito do adversário (eles marcaram)
      const isHome = e.winner === "home";
      const qLogged: LoggedAction = {
        id: nanoid(12),
        playerId: "",
        type: "freeball",
        zoneFrom: null,
        zoneTo: null,
        zoneFromX: null,
        zoneFromY: null,
        zoneToX: null,
        zoneToY: null,
        result: isHome ? "won" : "lost",
        rallyId: s.rallyId,
        rotation: s.rotation,
        setNumber: s.setNumber,
        timestamp: Date.now(),
        prevServingTeam: s.servingTeam,
        prevRotation: s.rotation,
      };
      let nextServingTeam = s.servingTeam;
      let nextRotation = s.rotation;
      const qWinner: Side = isHome ? "home" : "away";
      if (qWinner !== s.servingTeam) {
        nextServingTeam = qWinner;
        if (qWinner === "home") {
          // 1 → 6 → 5 → 4 → 3 → 2 → 1 (sentido horário).
          nextRotation = s.rotation === 1 ? 6 : s.rotation - 1;
        }
      }
      return {
        ...s,
        log: [...s.log, qLogged],
        rallyId: nanoid(8),
        homeScore: isHome ? s.homeScore + 1 : s.homeScore,
        awayScore: isHome ? s.awayScore : s.awayScore + 1,
        servingTeam: nextServingTeam,
        rotation: nextRotation,
      };
    }
    case "undo": {
      if (!s.log.length) return s;
      const last = s.log[s.log.length - 1];
      const pointScored =
        (last.type === "attack" && last.result === "kill") ||
        (last.type === "serve" && last.result === "ace") ||
        (last.type === "block" && last.result === "stuff") ||
        (last.type === "freeball" && last.result === "won");
      const pointLost =
        last.result === "error" ||
        (last.type === "attack" && last.result === "blocked") ||
        (last.type === "freeball" && last.result === "lost");
      // Restaura saque/rotação a partir do snapshot guardado na acção.
      // Se faltarem (acção hidratada da API), best-effort: mantém actuais.
      const restoredServing = last.prevServingTeam ?? s.servingTeam;
      const restoredRotation = last.prevRotation ?? s.rotation;
      return {
        ...s,
        log: s.log.slice(0, -1),
        homeScore: pointScored ? Math.max(0, s.homeScore - 1) : s.homeScore,
        awayScore: pointLost ? Math.max(0, s.awayScore - 1) : s.awayScore,
        servingTeam: restoredServing,
        rotation: restoredRotation,
      };
    }
    case "reset":
      return {
        ...initial,
        mode: s.mode,
        setNumber: s.setNumber,
        rotation: s.rotation,
        log: s.log,
        homeScore: s.homeScore,
        awayScore: s.awayScore,
        rallyId: nanoid(8),
      };
    case "adjustScore":
      return {
        ...s,
        homeScore:
          e.side === "home"
            ? Math.max(0, s.homeScore + e.delta)
            : s.homeScore,
        awayScore:
          e.side === "away"
            ? Math.max(0, s.awayScore + e.delta)
            : s.awayScore,
      };
    case "rotate":
      // direction=+1 → avança rotação (sentido volley: R diminui).
      // direction=-1 → desfaz rotação (R aumenta).
      return {
        ...s,
        rotation: ((s.rotation - 1 - e.direction + 6) % 6) + 1,
      };
    case "setServingTeam":
      return { ...s, servingTeam: e.team };
    case "nextSet":
      // Por convenção mantemos quem servia. O treinador pode trocar manual-
      // mente se a regra de competição alternar serviço entre sets.
      return {
        ...s,
        setNumber: Math.min(5, s.setNumber + 1),
        homeScore: 0,
        awayScore: 0,
        rotation: 1,
        rallyId: nanoid(8),
      };
    case "prevSet":
      return { ...s, setNumber: Math.max(1, s.setNumber - 1) };
    case "hydrate":
      return { ...s, log: e.actions };
    case "hydrateSession":
      return {
        ...initial,
        mode: s.mode,
        log: e.actions,
        homeScore: e.homeScore,
        awayScore: e.awayScore,
        setNumber: e.setNumber,
        rotation: e.rotation,
        servingTeam: e.servingTeam,
        rallyId: nanoid(8),
      };
    default:
      return s;
  }
}

export function useScoutState(mode: ScoutMode = "lite") {
  return useReducer(reducer, { ...initial, mode });
}

export type ScoutDispatch = ReturnType<typeof useScoutState>[1];
