/**
 * Exportador de ficheiros DataVolley (.dvw) a partir de dados VolleyIQ.
 *
 * Gera um subset válido do formato FILEFORMAT 2.0 que o DataVolley,
 * Click&Scout e Volley Station conseguem importar:
 *   [3FILEVERSION], [3MATCH], [3TEAMS], [3PLAYERS-H/V], [3SCOUT]
 *
 * Não incluímos setter calls, combinações de ataque ou zonas detalhadas
 * porque nem sempre temos esses dados — o ficheiro fica importável e
 * legível, com as métricas principais correctas.
 */

import type { ActionType, ActionResult } from "@shared/types";

// ── Mapping VolleyIQ → DataVolley ────────────────────────────────────────

const SKILL_CODE: Record<ActionType, string> = {
  serve: "S",
  reception: "R",
  set: "E",
  attack: "A",
  block: "B",
  dig: "D",
  freeball: "F",
};

/** Converte o resultado para o DV grade character. */
function toGrade(type: ActionType, result: ActionResult): string {
  switch (result) {
    case "kill":      return "#"; // A# — ponto de ataque
    case "ace":       return "#"; // S# — serviço directo
    case "stuff":     return "#"; // B# — bloco ponto
    case "perfect":   return "#"; // R/E/D# — qualidade máxima
    case "good":      return "+";
    case "poor":      return "-";
    case "error":     return "=";
    case "blocked":   return "/"; // ataque bloqueado
    case "tooled":    return "/"; // bloco: bola saiu pelo bloco
    case "in_play":   return "+"; // bola em jogo — neutro positivo
    case "touch":     return "+"; // toque de bloco
    case "won":       return "#"; // freeball ganho
    case "lost":      return "="; // freeball perdido
    default:          return "+";
  }
}

/** Gera o código de acção DataVolley (ex: `*01A.#`). */
function actionCode(
  side: "home" | "away",
  playerNumber: number,
  type: ActionType,
  result: ActionResult,
): string {
  const sideChar = side === "home" ? "*" : "a";
  const num = String(playerNumber).padStart(2, "0").slice(0, 2);
  const skill = SKILL_CODE[type] ?? "D";
  const grade = toGrade(type, result);
  // O subtype (posição 4) deixamos como "." para compatibilidade máxima.
  return `${sideChar}${num}${skill}.${grade}`;
}

// ── Interfaces do exportador ──────────────────────────────────────────────

export interface DvwExportPlayer {
  number: number;
  firstName: string;
  lastName: string;
  position: string; // OH, MB, S, L, OPP, DS
}

export interface DvwExportAction {
  side: "home" | "away";
  playerNumber: number;
  type: ActionType;
  result: ActionResult;
  setNumber?: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface DvwExportParams {
  matchDate: Date | null;
  competition: string | null;
  homeTeamName: string;
  awayTeamName: string;
  setsWon: number;  // home sets won
  setsLost: number; // home sets lost (= away sets won)
  homePlayers: DvwExportPlayer[];
  awayPlayers: DvwExportPlayer[];
  actions: DvwExportAction[];
}

// ── Helpers de secção ────────────────────────────────────────────────────

function positionToDvRole(pos: string): string {
  switch (pos) {
    case "L":   return "L";
    case "S":   return "S";
    case "MB":  return "C";  // DV usa "C" (central) para MB
    case "OPP": return "P";
    case "OH":  return "O";
    case "DS":  return "O";
    default:    return "";
  }
}

function playerLines(players: DvwExportPlayer[], side: "H" | "V"): string {
  return players
    .map((p, i) => {
      const num = String(p.number).padStart(2, "0");
      const code = `${side}${num}`;
      const role = positionToDvRole(p.position);
      const isLibero = p.position === "L" ? "1" : "0";
      // Formato: firstSet;number;id;s1;s2;s3;s4;s5;;;code;LASTNAME;FIRSTNAME;;role;;libero;
      return `1;${p.number};;;;;;;${code};${p.lastName.toUpperCase()};${p.firstName};;${role};;${isLibero};;`;
    })
    .join("\r\n");
}

function scoutLines(actions: DvwExportAction[]): string {
  const lines: string[] = [];
  for (const a of actions) {
    const code = actionCode(a.side, a.playerNumber, a.type, a.result);
    const setNum = a.setNumber ?? 1;
    const homeScore = a.homeScore ?? 0;
    const awayScore = a.awayScore ?? 0;
    // Campos: code;comb;hit_type;?;?;?;?;time;set;homeScore;awayScore;;;;;;p1..p6;p1..p6
    // Deixamos os campos de lineup vazios (não obrigatórios para importação).
    lines.push(`${code};;;;;;; ;${setNum};${homeScore};${awayScore};;;;;;;;0;0;0;0;0;0;0;0;0;0;0;0`);
  }
  return lines.join("\r\n");
}

// ── Gerador principal ────────────────────────────────────────────────────

export function generateDvw(params: DvwExportParams): string {
  const {
    matchDate,
    competition,
    homeTeamName,
    awayTeamName,
    setsWon,
    setsLost,
    homePlayers,
    awayPlayers,
    actions,
  } = params;

  const dateStr = matchDate
    ? `${String(matchDate.getDate()).padStart(2, "0")}/${String(matchDate.getMonth() + 1).padStart(2, "0")}/${matchDate.getFullYear()}`
    : "01/01/2024";

  // Abreviatura das equipas (até 3 chars)
  const homeCode = homeTeamName.replace(/\s+/g, "").slice(0, 3).toUpperCase() || "HOM";
  const awayCode = awayTeamName.replace(/\s+/g, "").slice(0, 3).toUpperCase() || "VIS";

  const sections: string[] = [
    "[3FILEVERSION]",
    "2",
    "",
    "[3MATCH]",
    // date;time;season;competition;phase;matchday;matchcode;result;...
    `${dateStr};00:00;;${competition ?? ""};;;${setsWon}:${setsLost};;;`,
    "",
    "[3COMMENTS]",
    `Exportado por VolleyIQ em ${new Date().toISOString().slice(0, 10)}`,
    "",
    "[3MORE]",
    "",
    "[3VIDEO]",
    "",
    "[3TEAMS]",
    // code;name;sets_won;head_coach;assistant_coach;color;
    `${homeCode};${homeTeamName};${setsWon};;;`,
    `${awayCode};${awayTeamName};${setsLost};;;`,
    "",
    "[3PLAYERS-H]",
    playerLines(homePlayers, "H"),
    "",
    "[3PLAYERS-V]",
    playerLines(awayPlayers, "V"),
    "",
    "[3SCOUT]",
    scoutLines(actions),
    "",
  ];

  return sections.join("\r\n");
}

// ── Download helper ──────────────────────────────────────────────────────

export function downloadDvw(content: string, filename: string) {
  // DataVolley espera windows-1252 mas UTF-8 com BOM é aceite pela maioria
  // dos importadores modernos (DV4, Volley Station, Click&Scout).
  const blob = new Blob(["﻿" + content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
