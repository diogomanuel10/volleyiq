import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { actions, matches } from "@shared/schema";
import type { Action, Match } from "@shared/schema";

/**
 * Agregação de KPIs para o Dashboard a partir da tabela `actions`.
 * Tudo calculado em memória — para datasets grandes (> 50 k acções) faria
 * mais sentido mover para SQL puro, mas para volume de treinador-de-clube
 * este shape é simples e previsível.
 */

export interface DashboardStats {
  sampleMatches: number;
  sampleActions: number;
  kpis: {
    killPct: number;
    sideOutPct: number;
    passRating: number;
    serveAcePct: number;
    attackEfficiency: number;
    record: string; // "W-L"
  };
  trend: Array<{ label: string; killPct: number; sideOut: number }>;
  radar: Array<{ axis: string; value: number }>;
  rotation: Array<{ rotation: string; pct: number }>;
}

const RECENT_LIMIT = 6;

export async function buildDashboard(teamId: string): Promise<DashboardStats> {
  const recentMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.teamId, teamId))
    .orderBy(desc(matches.date))
    .limit(RECENT_LIMIT);

  // Agregamos acções de todos os jogos recentes num só array — o filtro por
  // match continua lá em `a.matchId` para podermos construir a trend.
  const byMatch = new Map<string, Action[]>();
  for (const m of recentMatches) {
    const rows = await db
      .select()
      .from(actions)
      .where(eq(actions.matchId, m.id));
    byMatch.set(m.id, rows);
  }

  const wins = recentMatches.filter((m) => m.setsWon > m.setsLost).length;
  const losses = recentMatches.filter((m) => m.setsLost > m.setsWon).length;

  const all = [...byMatch.values()].flat();

  return {
    sampleMatches: recentMatches.length,
    sampleActions: all.length,
    kpis: {
      killPct: killPct(all),
      sideOutPct: sideOutPct(all),
      passRating: passRating(all),
      serveAcePct: serveAcePct(all),
      attackEfficiency: attackEff(all),
      record: `${wins}-${losses}`,
    },
    trend: buildTrend(recentMatches, byMatch),
    radar: buildRadar(all),
    rotation: buildRotation(all),
  };
}

// ── Cálculos individuais ────────────────────────────────────────────────
function killPct(a: Action[]) {
  const attacks = a.filter((x) => x.type === "attack");
  if (!attacks.length) return 0;
  const kills = attacks.filter((x) => x.result === "kill").length;
  return round1((kills / attacks.length) * 100);
}

function attackEff(a: Action[]) {
  const attacks = a.filter((x) => x.type === "attack");
  if (!attacks.length) return 0;
  const kills = attacks.filter((x) => x.result === "kill").length;
  const errors = attacks.filter(
    (x) => x.result === "error" || x.result === "blocked",
  ).length;
  return round3((kills - errors) / attacks.length);
}

function serveAcePct(a: Action[]) {
  const serves = a.filter((x) => x.type === "serve");
  if (!serves.length) return 0;
  const aces = serves.filter((x) => x.result === "ace").length;
  return round1((aces / serves.length) * 100);
}

function passRating(a: Action[]) {
  // Pontos estilo DataVolley: perfect=3, good=2, poor=1, error=0.
  const recs = a.filter((x) => x.type === "reception");
  if (!recs.length) return 0;
  const pts = recs.reduce((acc, x) => {
    if (x.result === "perfect") return acc + 3;
    if (x.result === "good") return acc + 2;
    if (x.result === "poor") return acc + 1;
    return acc;
  }, 0);
  return round2(pts / recs.length);
}

function sideOutPct(a: Action[]) {
  // Aproximação: num rally que começa com recepção nossa, ganhámos ponto?
  // Agrupamos por rallyId; consideramos side-out quando o rally contém
  // reception + uma acção final (kill/ace/block.stuff nossa OU erro adversário).
  const byRally = groupBy(
    a.filter((x) => x.rallyId),
    (x) => x.rallyId!,
  );
  let sideOut = 0;
  let total = 0;
  for (const rally of byRally.values()) {
    const hasReception = rally.some((x) => x.type === "reception");
    if (!hasReception) continue;
    total++;
    const won = rally.some(
      (x) =>
        (x.type === "attack" && x.result === "kill") ||
        (x.type === "block" && x.result === "stuff") ||
        (x.type === "serve" && x.result === "ace"),
    );
    if (won) sideOut++;
  }
  if (!total) return 0;
  return round1((sideOut / total) * 100);
}

function buildTrend(ms: Match[], byMatch: Map<string, Action[]>) {
  // Apresenta do mais antigo para o mais recente (esquerda→direita).
  const sorted = [...ms].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  return sorted.map((m, i) => ({
    label: `J-${sorted.length - i}`,
    killPct: killPct(byMatch.get(m.id) ?? []),
    sideOut: sideOutPct(byMatch.get(m.id) ?? []),
  }));
}

function buildRadar(a: Action[]) {
  // Cada eixo escalado 0–100 via heurísticas simples.
  const attacksKill = killPct(a);
  const serveAce = serveAcePct(a);
  const rec = passRating(a); // 0–3
  const blocks = a.filter((x) => x.type === "block");
  const blockPct = blocks.length
    ? (blocks.filter((x) => x.result === "stuff").length / blocks.length) * 100
    : 0;
  const digs = a.filter((x) => x.type === "dig");
  const digPct = digs.length
    ? (digs.filter((x) => x.result === "perfect" || x.result === "good").length /
        digs.length) *
      100
    : 0;
  const sets = a.filter((x) => x.type === "set");
  const setPct = sets.length
    ? (sets.filter((x) => x.result === "perfect" || x.result === "good").length /
        sets.length) *
      100
    : 0;

  return [
    { axis: "Attack", value: Math.round(attacksKill * 1.7) }, // escala ~80
    { axis: "Serve", value: Math.round(serveAce * 7) },
    { axis: "Reception", value: Math.round((rec / 3) * 100) },
    { axis: "Block", value: Math.round(blockPct) },
    { axis: "Dig", value: Math.round(digPct) },
    { axis: "Setting", value: Math.round(setPct) },
  ].map((x) => ({ ...x, value: Math.min(100, Math.max(0, x.value)) }));
}

function buildRotation(a: Action[]) {
  // Side-out % aproximado por rotação (campo `rotation` 1..6).
  const rotations = [1, 2, 3, 4, 5, 6] as const;
  return rotations.map((r) => {
    const rows = a.filter((x) => x.rotation === r);
    return {
      rotation: `R${r}`,
      pct: rows.length ? sideOutPct(rows) : 0,
    };
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────
function groupBy<T, K>(arr: T[], key: (t: T) => K) {
  const map = new Map<K, T[]>();
  for (const x of arr) {
    const k = key(x);
    const bucket = map.get(k);
    if (bucket) bucket.push(x);
    else map.set(k, [x]);
  }
  return map;
}
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
