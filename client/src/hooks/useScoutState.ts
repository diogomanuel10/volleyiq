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
  result: ActionResult;
  rallyId: string;
  rotation: number;
  setNumber: number;
  timestamp: number;
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

export interface ScoutState {
  mode: ScoutMode;
  step: Step;
  playerId: string | null;
  actionType: ActionType | null;
  zoneFrom: Zone | null;
  zoneTo: Zone | null;
  setNumber: number;
  rotation: number;
  homeScore: number;
  awayScore: number;
  rallyId: string;
  log: LoggedAction[];
}

type ScoutEvent =
  | { kind: "selectPlayer"; playerId: string }
  | { kind: "selectAction"; actionType: ActionType }
  | { kind: "selectZoneFrom"; zone: Zone }
  | { kind: "selectZoneTo"; zone: Zone }
  | { kind: "selectZone"; zone: Zone } // lite legacy
  | { kind: "skipZone" } // lite legacy
  | { kind: "selectResult"; result: ActionResult }
  | { kind: "undo" }
  | { kind: "reset" }
  | { kind: "setMode"; mode: ScoutMode }
  | { kind: "adjustScore"; side: "home" | "away"; delta: 1 | -1 }
  | { kind: "rotate"; direction: 1 | -1 }
  | { kind: "nextSet" }
  | { kind: "prevSet" }
  | { kind: "hydrate"; actions: LoggedAction[] };

const initial: ScoutState = {
  mode: "lite",
  step: "idle",
  playerId: null,
  actionType: null,
  zoneFrom: null,
  zoneTo: null,
  setNumber: 1,
  rotation: 1,
  homeScore: 0,
  awayScore: 0,
  rallyId: nanoid(8),
  log: [],
};

const TERMINAL_RESULTS = new Set<ActionResult>([
  "kill",
  "error",
  "ace",
  "blocked",
  "stuff",
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
      return { ...s, step: "zoneTo", zoneFrom: e.zone };
    case "selectZoneTo":
      return { ...s, step: "result", zoneTo: e.zone };
    // --- lite legacy ------------------------------------------------------
    case "selectZone":
      return { ...s, step: "result", zoneTo: e.zone };
    case "skipZone":
      return { ...s, step: "result", zoneTo: null };
    // ---------------------------------------------------------------------
    case "selectResult": {
      if (!s.playerId || !s.actionType) return s;
      const logged: LoggedAction = {
        id: nanoid(12),
        playerId: s.playerId,
        type: s.actionType,
        zoneFrom: s.zoneFrom,
        zoneTo: s.zoneTo,
        result: e.result,
        rallyId: s.rallyId,
        rotation: s.rotation,
        setNumber: s.setNumber,
        timestamp: Date.now(),
      };
      const pointScored =
        (logged.type === "attack" && logged.result === "kill") ||
        (logged.type === "serve" && logged.result === "ace") ||
        (logged.type === "block" && logged.result === "stuff");
      const pointLost =
        logged.result === "error" ||
        (logged.type === "attack" && logged.result === "blocked");

      return {
        ...s,
        step: "idle",
        playerId: null,
        actionType: null,
        zoneFrom: null,
        zoneTo: null,
        log: [...s.log, logged],
        rallyId: TERMINAL_RESULTS.has(logged.result)
          ? nanoid(8)
          : s.rallyId,
        homeScore: pointScored ? s.homeScore + 1 : s.homeScore,
        awayScore: pointLost ? s.awayScore + 1 : s.awayScore,
      };
    }
    case "undo": {
      if (!s.log.length) return s;
      const last = s.log[s.log.length - 1];
      const pointScored =
        (last.type === "attack" && last.result === "kill") ||
        (last.type === "serve" && last.result === "ace") ||
        (last.type === "block" && last.result === "stuff");
      const pointLost =
        last.result === "error" ||
        (last.type === "attack" && last.result === "blocked");
      return {
        ...s,
        log: s.log.slice(0, -1),
        homeScore: pointScored ? Math.max(0, s.homeScore - 1) : s.homeScore,
        awayScore: pointLost ? Math.max(0, s.awayScore - 1) : s.awayScore,
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
      return {
        ...s,
        rotation: ((s.rotation - 1 + e.direction + 6) % 6) + 1,
      };
    case "nextSet":
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
    default:
      return s;
  }
}

export function useScoutState(mode: ScoutMode = "lite") {
  return useReducer(reducer, { ...initial, mode });
}

export type ScoutDispatch = ReturnType<typeof useScoutState>[1];
