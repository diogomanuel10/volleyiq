import type { ActionResult, ActionType } from "@shared/types";

/**
 * Parser de ficheiros DataVolley `.dvw`. Cobre o subset que importa para a
 * VolleyIQ:
 *   - Metadata (data, competição, equipas)
 *   - Plantéis (home + away)
 *   - Acções (skill code + grade) com mapping para o nosso modelo
 *
 * Não cobre (intencionalmente, para a v1):
 *   - Zonas detalhadas (formato varia entre versões; deixamos `null`)
 *   - Combinações de ataque (XF, X1, ...)
 *   - Setter calls
 *   - Substitutions / lineup tracking explícito (usamos a rotação P1)
 *
 * Construído contra o sample público em
 * https://github.com/openvolley/datavolley/tree/master/inst/extdata
 */

export interface DvwTeam {
  shortCode: string; // ex: "BR4"
  name: string; // ex: "Braslovče"
  setsWon: number;
  headCoach: string | null;
  assistantCoach: string | null;
}

export interface DvwPlayer {
  side: "home" | "away";
  /** Número da camisola (1–99). */
  number: number;
  /** Código interno (ex: "BR1"). */
  code: string;
  lastName: string;
  firstName: string;
  /** Posição se vier no ficheiro: L, S, etc. — mapeada para o nosso enum. */
  positionGuess: "L" | "S" | "OH" | "MB" | "OPP" | "DS" | null;
}

export interface DvwAction {
  side: "home" | "away";
  playerNumber: number;
  type: ActionType;
  result: ActionResult;
  setNumber: number;
  homeScore: number;
  awayScore: number;
  rotation: number; // 1–6 (posição do P1 da equipa que faz a acção)
  /** Linha no ficheiro (debugging). */
  rawLine: string;
}

export interface DvwParseResult {
  matchDate: Date | null;
  competition: string | null;
  season: string | null;
  homeTeam: DvwTeam;
  awayTeam: DvwTeam;
  players: DvwPlayer[];
  actions: DvwAction[];
  /** Linhas que não conseguimos interpretar (relatório). */
  unparsedScoutLines: number;
  totalScoutLines: number;
}

const SKILL_MAP: Record<string, ActionType | null> = {
  S: "serve",
  R: "reception",
  E: "set",
  A: "attack",
  B: "block",
  D: "dig",
  // F (freeball) não tem tipo próprio no nosso modelo — mapeia para dig.
  F: "dig",
};

/**
 * Mapping de skill+grade -> resultado no nosso enum. As regras seguem a
 * convenção DataVolley: # é sempre o melhor, = é sempre erro próprio, /
 * tem semântica skill-dependent.
 */
function mapResult(skill: string, grade: string): ActionResult | null {
  const s = skill.toUpperCase();
  switch (grade) {
    case "=":
      return "error";
    case "#":
      if (s === "A") return "kill";
      if (s === "S") return "ace";
      if (s === "B") return "stuff";
      return "perfect";
    case "+":
      if (s === "A" || s === "S") return "in_play";
      if (s === "B") return "touch";
      return "good";
    case "!":
      if (s === "A" || s === "S") return "in_play";
      if (s === "B") return "touch";
      return "good";
    case "-":
      if (s === "A" || s === "S") return "in_play";
      if (s === "B") return "touch";
      return "poor";
    case "/":
      if (s === "A") return "blocked";
      if (s === "B") return "tooled";
      if (s === "S") return "in_play";
      return "poor";
    default:
      return null;
  }
}

function parseDateUS(s: string): Date | null {
  // Formato observado: MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(d.getTime()) ? null : d;
}

function guessPosition(code: string | undefined): DvwPlayer["positionGuess"] {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  // No campo "role" do .dvw, "L" = líbero, "C" = central. Outros campos
  // raramente vêm preenchidos, pelo que devolvemos null nesse caso e a UI
  // pede-te para confirmar antes de criar jogadoras novas.
  if (c === "L") return "L";
  if (c === "C") return "MB";
  if (c === "S") return "S";
  if (c === "P") return "OPP";
  if (c === "O" || c === "OH" || c === "S/L") return "OH";
  return null;
}

/**
 * Lê o ficheiro como string e devolve as secções como buckets de linhas.
 * Linhas em branco e comentários (# ou !) são ignorados.
 */
function splitSections(raw: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current: string | null = null;
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      current = line.slice(1, -1);
      sections.set(current, []);
      continue;
    }
    if (!current) continue;
    sections.get(current)!.push(line);
  }
  return sections;
}

function parseTeams(rows: string[]): { home: DvwTeam; away: DvwTeam } {
  // [3TEAMS] tem 2 linhas (home, away). Campos: code;name;sets_won;head_coach;assistant_coach;color;
  const make = (line: string | undefined): DvwTeam => {
    const f = (line ?? "").split(";");
    return {
      shortCode: f[0] ?? "",
      name: (f[1] ?? "").trim() || "Sem nome",
      setsWon: Number(f[2] ?? "0") || 0,
      headCoach: (f[3] ?? "").trim() || null,
      assistantCoach: (f[4] ?? "").trim() || null,
    };
  };
  return { home: make(rows[0]), away: make(rows[1]) };
}

function parsePlayers(
  rows: string[],
  side: "home" | "away",
): DvwPlayer[] {
  // Cada linha em [3PLAYERS-H/V]:
  //   firstSet?;number;id?;positions...;;;code;LASTNAME;FIRSTNAME;;role;;libero?;;;
  // Indices empiricamente verificados contra o sample (FILEFORMAT 2.0):
  //   8 = code (ex: BR1), 9 = lastName, 10 = firstName, 12 = role
  const players: DvwPlayer[] = [];
  for (const row of rows) {
    const f = row.split(";");
    const number = Number(f[1] ?? "");
    if (!Number.isFinite(number) || number < 1 || number > 99) continue;
    const code = (f[8] ?? "").trim();
    const lastName = (f[9] ?? "").trim();
    const firstName = (f[10] ?? "").trim();
    const role = (f[12] ?? "").trim();
    if (!lastName) continue;
    players.push({
      side,
      number,
      code: code || `${side === "home" ? "H" : "V"}${number}`,
      lastName,
      firstName: firstName || "",
      positionGuess: guessPosition(role),
    });
  }
  return players;
}

/** Identifica linhas de marcador (ex: `*p01:00`, `ap01:01`) e zone-only. */
function isScoreOrZoneLine(code: string): boolean {
  // Marcadores de pontuação: *p01:00 ou ap01:01
  if (/^[*a]p\d{2}:\d{2}$/.test(code)) return true;
  // Lineup/setter zone marker: *z3, az3, *P04, etc.
  if (/^[*a][zPpZ][^A-Z=#+!\-/]/.test(code) && !/[SREABDF]/.test(code))
    return true;
  // Linha de info `$$&H#` (winning symbol marker)
  if (/^[*a]\$/.test(code)) return true;
  return false;
}

interface ScoutLineParse {
  action: DvwAction | null;
  recognized: boolean;
}

function parseScoutLine(line: string): ScoutLineParse {
  const fields = line.split(";");
  const code = (fields[0] ?? "").trim();
  if (!code || code.length < 4) return { action: null, recognized: false };

  if (isScoreOrZoneLine(code)) return { action: null, recognized: true };

  const sideChar = code[0];
  if (sideChar !== "*" && sideChar !== "a")
    return { action: null, recognized: false };
  const side: "home" | "away" = sideChar === "*" ? "home" : "away";

  const playerNumber = Number(code.slice(1, 3));
  if (!Number.isFinite(playerNumber)) return { action: null, recognized: false };

  const skill = code[3];
  // O quarto char tem de ser uma skill conhecida (S, R, E, A, B, D, F).
  const type = SKILL_MAP[skill?.toUpperCase()];
  if (!type) return { action: null, recognized: false };

  // Grade está tipicamente no índice 5 (skill subtype no 4). Em alguns
  // ficheiros pode estar no 4 quando o subtype é omitido. Procuramos o
  // primeiro char de grade conhecido nas posições 4 ou 5.
  const grade =
    "#+!-=/".includes(code[5] ?? "")
      ? code[5]
      : "#+!-=/".includes(code[4] ?? "")
        ? code[4]
        : null;
  if (!grade) return { action: null, recognized: false };

  const result = mapResult(skill, grade);
  if (!result) return { action: null, recognized: false };

  // Após o code, os campos seguem este layout (FILEFORMAT 2.0):
  //   1 combination, 2 hit_type, 3 ?, 4 ?, 5 ?, 6 ?, 7 time,
  //   8 set_number, 9 home_score, 10 away_score, 11..14 ?,
  //   15..20 home_p1..p6, 21..26 away_p1..p6
  const setNumber = Number(fields[8] ?? "1") || 1;
  const homeScore = Number(fields[9] ?? "0") || 0;
  const awayScore = Number(fields[10] ?? "0") || 0;
  // Rotação: usamos o P1 da equipa que faz a acção como referência.
  const rotation =
    side === "home"
      ? Number(fields[15] ?? "1") || 1
      : Number(fields[21] ?? "1") || 1;

  return {
    recognized: true,
    action: {
      side,
      playerNumber,
      type,
      result,
      setNumber,
      homeScore,
      awayScore,
      rotation: Math.min(6, Math.max(1, rotation)),
      rawLine: line,
    },
  };
}

export function parseDvw(raw: string): DvwParseResult {
  const sections = splitSections(raw);
  const matchRow = sections.get("3MATCH")?.[0] ?? "";
  const matchFields = matchRow.split(";");
  const matchDate = parseDateUS(matchFields[0] ?? "");
  const season = (matchFields[2] ?? "").trim() || null;
  const competition = (matchFields[3] ?? "").trim() || null;

  const teamRows = sections.get("3TEAMS") ?? [];
  const { home, away } = parseTeams(teamRows);

  const players = [
    ...parsePlayers(sections.get("3PLAYERS-H") ?? [], "home"),
    ...parsePlayers(sections.get("3PLAYERS-V") ?? [], "away"),
  ];

  const scoutRows = sections.get("3SCOUT") ?? [];
  const actions: DvwAction[] = [];
  let unparsed = 0;
  for (const line of scoutRows) {
    const r = parseScoutLine(line);
    if (r.action) actions.push(r.action);
    else if (!r.recognized) unparsed++;
  }

  return {
    matchDate,
    competition,
    season,
    homeTeam: home,
    awayTeam: away,
    players,
    actions,
    unparsedScoutLines: unparsed,
    totalScoutLines: scoutRows.length,
  };
}

/**
 * Detecta a encoding lendo um ArrayBuffer. Os .dvw mais comuns vêm em
 * `windows-1252` (latim ocidental) ou `windows-1250` (centro europeu). Se
 * o utilizador fornece um TXT já decoded (UTF-8), usamos directamente.
 */
export async function readDvwFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // Heurística: tentamos UTF-8 primeiro; se vier com Replacement Char (U+FFFD)
  // assumimos windows-1252.
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("windows-1252").decode(buf);
  } catch {
    return utf8;
  }
}
