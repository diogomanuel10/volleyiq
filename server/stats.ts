import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { actions, matches, players } from "@shared/schema";
import type { Action, Match, Player } from "@shared/schema";
import type {
  PatternDetectionInput,
  TrainingRecommendationInput,
} from "@shared/types";

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

// ── Scouting report aggregation ─────────────────────────────────────────
export interface ScoutingAggregation {
  opponent: string;
  sampleMatches: number;
  matchIds: string[];
  input: PatternDetectionInput;
  serveZones: Array<{ zone: string; count: number }>;
  attackZones: Array<{ zone: string; count: number }>;
  rotationSideOut: Array<{ rotation: string; pct: number }>;
}

export async function buildScoutingReport(
  teamId: string,
  opponent: string,
): Promise<ScoutingAggregation | null> {
  const opponentMatches = await db
    .select()
    .from(matches)
    .where(and(eq(matches.teamId, teamId), eq(matches.opponent, opponent)))
    .orderBy(desc(matches.date));

  if (!opponentMatches.length) return null;

  const all: Action[] = [];
  for (const m of opponentMatches) {
    const rows = await db
      .select()
      .from(actions)
      .where(eq(actions.matchId, m.id));
    all.push(...rows);
  }

  const serveTargets = countBy(
    all.filter((a) => a.type === "serve" && a.zoneTo != null),
    (a) => String(a.zoneTo),
  );
  const attackByRotation: Record<string, Record<string, number>> = {};
  for (const a of all) {
    if (a.type !== "attack" || a.zoneTo == null || a.rotation == null) continue;
    const rot = String(a.rotation);
    const zone = String(a.zoneTo);
    attackByRotation[rot] ??= {};
    attackByRotation[rot][zone] = (attackByRotation[rot][zone] ?? 0) + 1;
  }

  const rotationSideOutMap: Record<string, number> = {};
  for (let r = 1; r <= 6; r++) {
    const rows = all.filter((a) => a.rotation === r);
    rotationSideOutMap[`R${r}`] = rows.length ? sideOutPct(rows) : 0;
  }

  // Distribuição do distribuidor: aproximação via acções "set" por posição
  // do jogador que distribuiu (lookup rápido via tabela players).
  const setterPlayers = await db.select().from(players).where(eq(players.teamId, teamId));
  const playerPos = new Map<string, Player["position"]>(
    setterPlayers.map((p) => [p.id, p.position]),
  );
  const setterDistribution = countBy(
    all.filter((a) => a.type === "set" && a.playerId),
    (a) => playerPos.get(a.playerId!) ?? "?",
  );

  return {
    opponent,
    sampleMatches: opponentMatches.length,
    matchIds: opponentMatches.map((m) => m.id),
    input: {
      teamId,
      opponent,
      sampleSize: all.length,
      serveTargets,
      attackByRotation,
      rotationSideOut: rotationSideOutMap,
      setterDistribution,
    },
    serveZones: Object.entries(serveTargets)
      .map(([zone, count]) => ({ zone, count }))
      .sort((a, b) => Number(a.zone) - Number(b.zone)),
    attackZones: Object.entries(
      all
        .filter((a) => a.type === "attack" && a.zoneTo != null)
        .reduce<Record<string, number>>((acc, a) => {
          const z = String(a.zoneTo);
          acc[z] = (acc[z] ?? 0) + 1;
          return acc;
        }, {}),
    )
      .map(([zone, count]) => ({ zone, count }))
      .sort((a, b) => Number(a.zone) - Number(b.zone)),
    rotationSideOut: Object.entries(rotationSideOutMap).map(
      ([rotation, pct]) => ({ rotation, pct }),
    ),
  };
}

// ── Post-match per-player ───────────────────────────────────────────────
export interface PlayerMatchLine {
  playerId: string;
  firstName: string;
  lastName: string;
  number: number;
  position: Player["position"];
  kills: number;
  attackErrors: number;
  attackAttempts: number;
  killPct: number;
  attackEff: number;
  aces: number;
  blocks: number;
  digs: number;
  receptions: number;
  passRating: number;
  rating: number; // 0-100
}

export interface TaggedMoment {
  actionId: string;
  videoTimeSec: number;
  playerName: string | null;
  playerNumber: number | null;
  type: string;
  result: string;
}

export interface PostMatchSummary {
  matchId: string;
  opponent: string;
  setsWon: number;
  setsLost: number;
  totalActions: number;
  videoUrl: string | null;
  teamKpis: DashboardStats["kpis"];
  players: PlayerMatchLine[];
  highlights: Array<{
    playerId: string;
    title: string;
    subtitle: string;
  }>;
  taggedMoments: TaggedMoment[];
}

export async function buildPostMatch(
  teamId: string,
  matchId: string,
): Promise<PostMatchSummary | null> {
  const [match] = await db
    .select()
    .from(matches)
    .where(and(eq(matches.teamId, teamId), eq(matches.id, matchId)));
  if (!match) return null;
  const rows = await db
    .select()
    .from(actions)
    .where(eq(actions.matchId, matchId));
  const roster = await db.select().from(players).where(eq(players.teamId, teamId));

  const wins = match.setsWon > match.setsLost ? 1 : 0;
  const losses = match.setsLost > match.setsWon ? 1 : 0;

  const lines: PlayerMatchLine[] = roster
    .map((p) => {
      const mine = rows.filter((a) => a.playerId === p.id);
      if (!mine.length) return null;
      const attacks = mine.filter((a) => a.type === "attack");
      const kills = attacks.filter((a) => a.result === "kill").length;
      const attackErr = attacks.filter(
        (a) => a.result === "error" || a.result === "blocked",
      ).length;
      const recs = mine.filter((a) => a.type === "reception");
      const recPts = recs.reduce((acc, a) => {
        if (a.result === "perfect") return acc + 3;
        if (a.result === "good") return acc + 2;
        if (a.result === "poor") return acc + 1;
        return acc;
      }, 0);
      const blocks = mine.filter(
        (a) => a.type === "block" && a.result === "stuff",
      ).length;
      const digs = mine.filter(
        (a) => a.type === "dig" && (a.result === "perfect" || a.result === "good"),
      ).length;
      const aces = mine.filter(
        (a) => a.type === "serve" && a.result === "ace",
      ).length;

      const killPct = attacks.length ? (kills / attacks.length) * 100 : 0;
      const eff = attacks.length ? (kills - attackErr) / attacks.length : 0;
      const passRating = recs.length ? recPts / recs.length : 0;
      // Rating agregado 0-100 — soma pondera ataque, serviço, bloco, defesa e passe.
      const rating =
        Math.min(100, Math.round(
          killPct * 0.4 +
            aces * 4 +
            blocks * 5 +
            digs * 1.5 +
            (passRating / 3) * 30,
        ));

      const line: PlayerMatchLine = {
        playerId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        number: p.number,
        position: p.position,
        kills,
        attackErrors: attackErr,
        attackAttempts: attacks.length,
        killPct: round1(killPct),
        attackEff: round3(eff),
        aces,
        blocks,
        digs,
        receptions: recs.length,
        passRating: round2(passRating),
        rating,
      };
      return line;
    })
    .filter((x): x is PlayerMatchLine => !!x)
    .sort((a, b) => b.rating - a.rating);

  const top = lines.slice(0, 3);
  const highlights = top.map((l) => ({
    playerId: l.playerId,
    title: `#${l.number} ${l.firstName} ${l.lastName}`,
    subtitle: `${l.kills} kills · ${l.aces} aces · ${l.blocks} blocks · rating ${l.rating}`,
  }));

  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const taggedMoments: TaggedMoment[] = rows
    .filter((a) => a.videoTimeSec != null)
    .sort((a, b) => (a.videoTimeSec ?? 0) - (b.videoTimeSec ?? 0))
    .map((a) => {
      const p = a.playerId ? rosterById.get(a.playerId) : null;
      return {
        actionId: a.id,
        videoTimeSec: a.videoTimeSec!,
        playerName: p ? `${p.firstName} ${p.lastName}` : null,
        playerNumber: p?.number ?? null,
        type: a.type,
        result: a.result,
      };
    });

  return {
    matchId,
    opponent: match.opponent,
    setsWon: match.setsWon,
    setsLost: match.setsLost,
    totalActions: rows.length,
    videoUrl: match.videoUrl ?? null,
    teamKpis: {
      killPct: killPct(rows),
      sideOutPct: sideOutPct(rows),
      passRating: passRating(rows),
      serveAcePct: serveAcePct(rows),
      attackEfficiency: attackEff(rows),
      record: `${wins}-${losses}`,
    },
    players: lines,
    highlights,
    taggedMoments,
  };
}

// ── Player training input ──────────────────────────────────────────────
export interface PlayerSummary {
  player: Player;
  actions: number;
  kpis: TrainingRecommendationInput["kpis"];
  weaknesses: string[];
}

export async function buildPlayerSummary(
  teamId: string,
  playerId: string,
): Promise<PlayerSummary | null> {
  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.teamId, teamId), eq(players.id, playerId)));
  if (!player) return null;

  // Acções recentes em todos os jogos da equipa (últimos 6).
  const recentMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.teamId, teamId))
    .orderBy(desc(matches.date))
    .limit(RECENT_LIMIT);
  const matchIds = new Set(recentMatches.map((m) => m.id));
  const all = await db
    .select()
    .from(actions)
    .where(eq(actions.playerId, playerId));
  const recent = all.filter((a) => matchIds.has(a.matchId));

  const attacks = recent.filter((a) => a.type === "attack");
  const kills = attacks.filter((a) => a.result === "kill").length;
  const attackErr = attacks.filter(
    (a) => a.result === "error" || a.result === "blocked",
  ).length;
  const recs = recent.filter((a) => a.type === "reception");
  const recPts = recs.reduce((acc, a) => {
    if (a.result === "perfect") return acc + 3;
    if (a.result === "good") return acc + 2;
    if (a.result === "poor") return acc + 1;
    return acc;
  }, 0);
  const serves = recent.filter((a) => a.type === "serve");
  const aces = serves.filter((a) => a.result === "ace").length;
  const blocks = recent.filter(
    (a) => a.type === "block" && a.result === "stuff",
  ).length;
  const digs = recent.filter(
    (a) => a.type === "dig" && (a.result === "perfect" || a.result === "good"),
  ).length;

  const killPct = attacks.length ? (kills / attacks.length) * 100 : 0;
  const eff = attacks.length ? (kills - attackErr) / attacks.length : 0;
  const passRating = recs.length ? recPts / recs.length : 0;
  const serveAcePct = serves.length ? (aces / serves.length) * 100 : 0;

  const weaknesses: string[] = [];
  if (attacks.length >= 5 && killPct < 35) {
    weaknesses.push(
      `Kill% baixo (${round1(killPct)}%) sobre ${attacks.length} ataques.`,
    );
  }
  if (recs.length >= 5 && passRating < 2) {
    weaknesses.push(
      `Pass rating ${round2(passRating)} em ${recs.length} recepções — margem clara.`,
    );
  }
  if (serves.length >= 8 && serveAcePct < 4) {
    weaknesses.push(`Serviço pouco agressivo (ace% ${round1(serveAcePct)}).`);
  }
  if (player.position === "MB" && blocks === 0 && recent.length > 20) {
    weaknesses.push("Nenhum stuff block registado nos últimos jogos.");
  }

  return {
    player,
    actions: recent.length,
    kpis: {
      killPct: round1(killPct),
      attackEff: round3(eff),
      passRating: round2(passRating),
      serveAcePct: round1(serveAcePct),
      blocks,
      digs,
    },
    weaknesses,
  };
}

function countBy<T>(arr: T[], key: (t: T) => string) {
  return arr.reduce<Record<string, number>>((acc, x) => {
    const k = key(x);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
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
