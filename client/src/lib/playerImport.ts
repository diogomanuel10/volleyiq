import type { Position } from "@shared/types";

/**
 * Linhas saídas do parser (antes da validação). Todos os campos são opcionais
 * e em string bruta; a validação converte para os tipos finais.
 */
export interface RawRow {
  rowNumber: number; // linha no ficheiro (1 = primeira com dados, não header)
  firstName?: string;
  lastName?: string;
  number?: string;
  position?: string;
  heightCm?: string;
  dominantHand?: string;
  birthDate?: string;
  active?: string;
}

export interface ImportPlayer {
  firstName: string;
  lastName: string;
  number: number;
  position: Position;
  heightCm: number | null;
  dominantHand: "left" | "right" | null;
  birthDate: string | null;
  active: boolean;
}

export interface RowError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: Array<{ rowNumber: number; player: ImportPlayer }>;
  errors: RowError[];
  warnings: RowError[]; // ex: número duplicado (não bloqueia)
}

// ── Coluna header -> campo ────────────────────────────────────────────────
// Aceita PT e EN, case-insensitive, ignora acentos e espaços extra.

const HEADERS: Record<keyof Omit<RawRow, "rowNumber">, string[]> = {
  firstName: ["nome", "primeiro nome", "first name", "firstname"],
  lastName: ["apelido", "ultimo nome", "last name", "lastname", "sobrenome"],
  number: ["numero", "número", "n", "#", "jersey", "camisola"],
  position: ["posicao", "posição", "position", "pos"],
  heightCm: [
    "altura",
    "altura cm",
    "altura (cm)",
    "height",
    "height cm",
    "heightcm",
  ],
  dominantHand: [
    "mao",
    "mão",
    "mao dominante",
    "mão dominante",
    "dominant hand",
    "hand",
  ],
  birthDate: [
    "data de nascimento",
    "nascimento",
    "birth date",
    "birthdate",
    "dob",
  ],
  active: ["activa", "activo", "ativa", "ativo", "active", "no roster"],
};

function normalise(s: string): string {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function matchHeader(header: string): keyof Omit<RawRow, "rowNumber"> | null {
  const h = normalise(header);
  for (const [field, aliases] of Object.entries(HEADERS) as Array<
    [keyof Omit<RawRow, "rowNumber">, string[]]
  >) {
    if (aliases.some((a) => normalise(a) === h)) return field;
  }
  return null;
}

/**
 * Aceita um ArrayBuffer (xls/xlsx/csv) ou uma string CSV e devolve linhas
 * brutas. Usa SheetJS dinamicamente para manter o bundle inicial leve.
 */
export async function parseSpreadsheet(
  source: ArrayBuffer | string,
): Promise<RawRow[]> {
  const XLSX = await import("xlsx");
  const wb =
    typeof source === "string"
      ? XLSX.read(source, { type: "string" })
      : XLSX.read(source, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });
  if (!matrix.length) return [];

  const [headerRow, ...dataRows] = matrix;
  const columnMap: Array<keyof Omit<RawRow, "rowNumber"> | null> =
    headerRow.map((h) => matchHeader(String(h ?? "")));

  const rows: RawRow[] = [];
  dataRows.forEach((row, i) => {
    // Ignora linhas totalmente vazias (útil quando o Excel deixa "caudas").
    if (row.every((c) => !c || !String(c).trim())) return;
    const raw: RawRow = { rowNumber: i + 1 };
    row.forEach((cell, idx) => {
      const field = columnMap[idx];
      if (!field) return;
      const value = cell == null ? "" : String(cell).trim();
      if (value) raw[field] = value;
    });
    rows.push(raw);
  });
  return rows;
}

// ── Normalização e validação ───────────────────────────────────────────────

const POSITION_MAP: Record<string, Position> = {
  oh: "OH",
  ponta: "OH",
  "outside hitter": "OH",
  opp: "OPP",
  oposto: "OPP",
  opposite: "OPP",
  mb: "MB",
  central: "MB",
  "middle blocker": "MB",
  s: "S",
  setter: "S",
  distribuidor: "S",
  distribuidora: "S",
  l: "L",
  libero: "L",
  "líbero": "L",
  ds: "DS",
  defensivo: "DS",
  defensiva: "DS",
  "defensive specialist": "DS",
};

function parsePosition(raw: string): Position | null {
  const key = normalise(raw);
  return POSITION_MAP[key] ?? null;
}

function parseHand(raw: string): "left" | "right" | null {
  const k = normalise(raw);
  if (["left", "esq", "esquerda", "e", "l"].includes(k)) return "left";
  if (["right", "dir", "direita", "d", "r"].includes(k)) return "right";
  return null;
}

const TRUTHY = new Set(["1", "true", "sim", "yes", "y", "s", "activo", "activa", "ativo", "ativa"]);
const FALSY = new Set(["0", "false", "nao", "não", "no", "n", "inactivo", "inactiva", "inativo", "inativa"]);
function parseBool(raw: string | undefined, defaultVal = true): boolean {
  if (raw == null) return defaultVal;
  const k = normalise(raw);
  if (!k) return defaultVal;
  if (TRUTHY.has(k)) return true;
  if (FALSY.has(k)) return false;
  return defaultVal;
}

function parseInt0(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function validateRows(
  rows: RawRow[],
  existingNumbers: number[] = [],
): ValidationResult {
  const valid: Array<{ rowNumber: number; player: ImportPlayer }> = [];
  const errors: RowError[] = [];
  const warnings: RowError[] = [];
  const seenNumbers = new Map<number, number>(); // num -> rowNumber

  for (const row of rows) {
    const rowErrors: RowError[] = [];

    const firstName = row.firstName?.trim();
    if (!firstName)
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "Nome",
        message: "Obrigatório",
      });

    const lastName = row.lastName?.trim();
    if (!lastName)
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "Apelido",
        message: "Obrigatório",
      });

    const number = parseInt0(row.number);
    if (number == null)
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "Número",
        message: "Número inválido",
      });
    else if (number < 1 || number > 99)
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "Número",
        message: "Entre 1 e 99",
      });

    const position = row.position ? parsePosition(row.position) : null;
    if (!row.position)
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "Posição",
        message: "Obrigatório",
      });
    else if (!position)
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "Posição",
        message: `'${row.position}' não reconhecida (usa OH/OPP/MB/S/L/DS ou Ponta/Oposto/Central/Distribuidor/Líbero/Defensivo)`,
      });

    const heightCm = parseInt0(row.heightCm);
    if (row.heightCm && heightCm == null)
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "Altura",
        message: "Não é um número",
      });
    else if (heightCm != null && (heightCm < 100 || heightCm > 230))
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "Altura",
        message: "Entre 100 e 230 cm",
      });

    const hand = row.dominantHand ? parseHand(row.dominantHand) : null;
    if (row.dominantHand && !hand)
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "Mão",
        message: "Usa 'esquerda' / 'direita' ou 'left' / 'right'",
      });

    if (rowErrors.length) {
      errors.push(...rowErrors);
      continue;
    }

    const player: ImportPlayer = {
      firstName: firstName!,
      lastName: lastName!,
      number: number!,
      position: position!,
      heightCm,
      dominantHand: hand,
      birthDate: row.birthDate?.trim() || null,
      active: parseBool(row.active, true),
    };

    if (seenNumbers.has(player.number)) {
      warnings.push({
        rowNumber: row.rowNumber,
        field: "Número",
        message: `Número ${player.number} repete-se (também na linha ${seenNumbers.get(player.number)})`,
      });
    } else {
      seenNumbers.set(player.number, row.rowNumber);
    }
    if (existingNumbers.includes(player.number)) {
      warnings.push({
        rowNumber: row.rowNumber,
        field: "Número",
        message: `Número ${player.number} já existe no roster actual`,
      });
    }

    valid.push({ rowNumber: row.rowNumber, player });
  }

  return { valid, errors, warnings };
}

// ── Template ───────────────────────────────────────────────────────────────

export function buildCsvTemplate(): string {
  const header = [
    "Nome",
    "Apelido",
    "Número",
    "Posição",
    "Altura (cm)",
    "Mão",
    "Data de nascimento",
    "Activa",
  ];
  const example = [
    "Rita",
    "Almeida",
    "1",
    "L",
    "170",
    "direita",
    "2001-05-10",
    "sim",
  ];
  return [header.join(","), example.join(",")].join("\n") + "\n";
}

export function downloadTemplate(filename = "template-jogadores.csv") {
  const blob = new Blob(["﻿" + buildCsvTemplate()], {
    // BOM para o Excel abrir os acentos correctamente.
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
