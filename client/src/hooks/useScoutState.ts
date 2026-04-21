import { useReducer } from "react";
import { nanoid } from "nanoid";
import type {
  ActionResult,
  ActionType,
  Zone,
} from "@shared/types";

/**
 * Estado de scouting em memória. Cada registo final é também persistido
 * em `/api/actions`; este hook apenas orquestra o fluxo de seleção:
 *
 *   (1) selecionar jogadora  →  (2) tipo de acção  →  (3) zona  →  (4) resultado
 *
 * O id da acção é gerado client-side (nanoid) para permitir Undo optimista
 * antes do round-trip à API.
 */

export interface LoggedAction {
  id: string;
  playerId: string;
  type: ActionType;
  zoneTo: Zone | null;
  result: ActionResult;
  rallyId: string;
  rotation: number;
  setNumber: number;
  timestamp: number;
}

export type Step = "player" | "action" | "zone" | "result" | "idle";

interface ScoutState {
  step: Step;
  playerId: string | null;
  actionType: ActionType | null;
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
  | { kind: "selectZone"; zone: Zone }
  | { kind: "skipZone" }
  | { kind: "selectResult"; result: ActionResult }
  | { kind: "undo" }
  | { kind: "reset" }
  | { kind: "adjustScore"; side: "home" | "away"; delta: 1 | -1 }
  | { kind: "rotate"; direction: 1 | -1 }
  | { kind: "nextSet" }
  | { kind: "prevSet" }
  | { kind: "hydrate"; actions: LoggedAction[] };

const initial: ScoutState = {
  step: "idle",
  playerId: null,
  actionType: null,
  zoneTo: null,
  setNumber: 1,
  rotation: 1,
  homeScore: 0,
  awayScore: 0,
  rallyId: nanoid(8),
  log: [],
};

function reducer(s: ScoutState, e: ScoutEvent): ScoutState {
  switch (e.kind) {
    case "selectPlayer":
      return { ...s, step: "action", playerId: e.playerId };
    case "selectAction":
      return { ...s, step: "zone", actionType: e.actionType };
    case "selectZone":
      return { ...s, step: "result", zoneTo: e.zone };
    case "skipZone":
      return { ...s, step: "result", zoneTo: null };
    case "selectResult": {
      if (!s.playerId || !s.actionType) return s;
      const logged: LoggedAction = {
        id: nanoid(12),
        playerId: s.playerId,
        type: s.actionType,
        zoneTo: s.zoneTo,
        result: e.result,
        rallyId: s.rallyId,
        rotation: s.rotation,
        setNumber: s.setNumber,
        timestamp: Date.now(),
      };
      const terminals = new Set<ActionResult>([
        "kill",
        "error",
        "ace",
        "blocked",
        "stuff",
      ]);
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
        zoneTo: null,
        log: [...s.log, logged],
        rallyId: terminals.has(logged.result) ? nanoid(8) : s.rallyId,
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

export function useScoutState() {
  return useReducer(reducer, initial);
}

export type ScoutDispatch = ReturnType<typeof useScoutState>[1];
