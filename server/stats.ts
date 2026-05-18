import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { actions, matches, players, sets } from "@shared/schema";
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
  // Agregados ao nível da época (todos os jogos terminados, não apenas os
  // últimos 6). Estas listas alimentam os blocos "Top atacantes" e
  // "Adversários" no Dashboard.
  topScorers: Array<{
    playerId: string;
    name: string;
    number: number;
    position: string;
    matches: number;
    kills: number;
    attackErrors: number;
    aces: number;
    blocks: number;
    points: number; // kills + aces + stuffs
  }>;
  opponentBreakdown: Array<{
    opponent: string;
    matches: number;
    wins: number;
    losses: number;
    setsWon: number;
    setsLost: number;
  }>;
  rotationStats: RotationStat[];
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

  // ── Agregados de época (todos os jogos do team, não só os 6 recentes) ──
  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.teamId, teamId));
  const allActionRows: Action[] = [];
  if (allMatches.length) {
    const ids = allMatches.map((m) => m.id);
    const rows = await db
      .select()
      .from(actions)
      .where(inArray(actions.matchId, ids));
    allActionRows.push(...rows);
  }
  const roster = await db
    .select()
    .from(players)
    .where(eq(players.teamId, teamId));
  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const sortedSeason = [...allActionRows].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const rotationStats = buildRotationStats(sortedSeason);
  const topScorers = buildTopScorers(allActionRows, rosterById);
  const opponentBreakdown = buildOpponentBreakdown(allMatches);

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
    topScorers,
    opponentBreakdown,
    rotationStats,
  };
}

function buildTopScorers(
  rows: Action[],
  rosterById: Map<string, Player>,
): DashboardStats["topScorers"] {
  // Agrupa por player; conta kills (attack#), aces (serve#), stuffs (block#)
  // e attack errors. "points" = kills + aces + stuffs (pontos directos).
  const buckets = new Map<
    string,
    {
      playerId: string;
      matches: Set<string>;
      kills: number;
      attackErrors: number;
      aces: number;
      blocks: number;
    }
  >();
  for (const a of rows) {
    if (!a.playerId) continue;
    let b = buckets.get(a.playerId);
    if (!b) {
      b = {
        playerId: a.playerId,
        matches: new Set(),
        kills: 0,
        attackErrors: 0,
        aces: 0,
        blocks: 0,
      };
      buckets.set(a.playerId, b);
    }
    b.matches.add(a.matchId);
    if (a.type === "attack" && a.result === "kill") b.kills++;
    if (
      a.type === "attack" &&
      (a.result === "error" || a.result === "blocked")
    )
      b.attackErrors++;
    if (a.type === "serve" && a.result === "ace") b.aces++;
    if (a.type === "block" && a.result === "stuff") b.blocks++;
  }
  const list = [];
  for (const b of buckets.values()) {
    const p = rosterById.get(b.playerId);
    if (!p) continue;
    list.push({
      playerId: b.playerId,
      name: `${p.firstName} ${p.lastName}`,
      number: p.number,
      position: p.position,
      matches: b.matches.size,
      kills: b.kills,
      attackErrors: b.attackErrors,
      aces: b.aces,
      blocks: b.blocks,
      points: b.kills + b.aces + b.blocks,
    });
  }
  return list.sort((a, b) => b.points - a.points).slice(0, 10);
}

function buildOpponentBreakdown(
  ms: Match[],
): DashboardStats["opponentBreakdown"] {
  // Só conta jogos terminados.
  const finished = ms.filter((m) => m.status === "finished");
  const buckets = new Map<
    string,
    {
      opponent: string;
      matches: number;
      wins: number;
      losses: number;
      setsWon: number;
      setsLost: number;
    }
  >();
  for (const m of finished) {
    const key = m.opponent.trim() || "—";
    let b = buckets.get(key);
    if (!b) {
      b = {
        opponent: key,
        matches: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
      };
      buckets.set(key, b);
    }
    b.matches++;
    b.setsWon += m.setsWon;
    b.setsLost += m.setsLost;
    if (m.setsWon > m.setsLost) b.wins++;
    else if (m.setsLost > m.setsWon) b.losses++;
  }
  return Array.from(buckets.values()).sort(
    (a, b) => b.matches - a.matches || b.wins - a.wins,
  );
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

/**
 * Estatísticas por rotação 1–6. `sideOutPct` = % de rallies ganhos quando a
 * equipa recebia (não estava a servir). `breakPointPct` = % de rallies
 * ganhos quando estava a servir. KPIs que ditam a rotação fraca e forte.
 */
export interface RotationStat {
  rotation: number;
  totalRallies: number;
  serveRallies: number;
  serveWon: number;
  receiveRallies: number;
  receiveWon: number;
  sideOutPct: number;
  breakPointPct: number;
}

export interface HeatmapZoneCount {
  zone: number;
  count: number;
  kills?: number; // só para attack/serve — quantos terminaram em ponto
}

export interface Heatmap {
  type: "attack" | "serve" | "reception";
  zones: HeatmapZoneCount[];
  total: number;
  maxCount: number;
}

export interface SetterTarget {
  attackerId: string;
  attackerName: string;
  attackerNumber: number;
  attackerPosition: Player["position"];
  count: number;
  kills: number;
}

export interface SetterDistribution {
  setterId: string;
  setterName: string;
  setterNumber: number;
  totalSets: number;
  targets: SetterTarget[];
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
  rotationStats: RotationStat[];
  attackHeatmap: Heatmap;
  serveHeatmap: Heatmap;
  receptionHeatmap: Heatmap;
  setters: SetterDistribution[];
  setStats: Array<{
    setNumber: number;
    homeScore: number;
    awayScore: number;
    killPct: number;
    sideOutPct: number;
    passRating: number;
    totalActions: number;
  }>;
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

  const sortedRows = [...rows].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const rotationStats = buildRotationStats(sortedRows);
  const attackHeatmap = buildHeatmap(sortedRows, "attack");
  const serveHeatmap = buildHeatmap(sortedRows, "serve");
  const receptionHeatmap = buildHeatmap(sortedRows, "reception");
  const setters = buildSetterDistribution(sortedRows, rosterById);

  // Per-set breakdown
  const matchSets = await db
    .select()
    .from(sets)
    .where(eq(sets.matchId, matchId));
  matchSets.sort((a, b) => a.number - b.number);
  const setStats = matchSets.map((s) => {
    const setRows = rows.filter((a) => a.setId === s.id);
    return {
      setNumber: s.number,
      homeScore: s.homeScore,
      awayScore: s.awayScore,
      killPct: round1(killPct(setRows)),
      sideOutPct: round1(sideOutPct(setRows)),
      passRating: round2(passRating(setRows)),
      totalActions: setRows.length,
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
    rotationStats,
    attackHeatmap,
    serveHeatmap,
    receptionHeatmap,
    setters,
    setStats,
  };
}

// ── Rotation stats ──────────────────────────────────────────────────────
type ActionRow = typeof actions.$inferSelect;

const POINT_FOR_US = (a: ActionRow) =>
  (a.type === "attack" && a.result === "kill") ||
  (a.type === "serve" && a.result === "ace") ||
  (a.type === "block" && a.result === "stuff");

const POINT_AGAINST_US = (a: ActionRow) =>
  a.result === "error" || (a.type === "attack" && a.result === "blocked");

function buildRotationStats(sortedRows: ActionRow[]): RotationStat[] {
  // Agrupa por rallyId. Para cada rally: rotação inicial, se servimos ou
  // recebemos, e se ganhámos. A "vitória" no rally é determinada pelo
  // resultado da última acção registada (mesmo modelo do reducer client).
  const rallies = groupBy(sortedRows, (a) => a.rallyId ?? a.id);
  const buckets = new Map<number, RotationStat>();
  for (let r = 1; r <= 6; r++) {
    buckets.set(r, {
      rotation: r,
      totalRallies: 0,
      serveRallies: 0,
      serveWon: 0,
      receiveRallies: 0,
      receiveWon: 0,
      sideOutPct: 0,
      breakPointPct: 0,
    });
  }

  for (const [, rallyActions] of rallies) {
    if (!rallyActions.length) continue;
    const first = rallyActions[0];
    const last = rallyActions[rallyActions.length - 1];
    const rot = first.rotation ?? 1;
    if (rot < 1 || rot > 6) continue;
    const stat = buckets.get(rot)!;

    const weServed = first.type === "serve";
    const weWon = POINT_FOR_US(last) && !POINT_AGAINST_US(last);
    const weLost = POINT_AGAINST_US(last);

    stat.totalRallies++;
    if (weServed) {
      stat.serveRallies++;
      if (weWon) stat.serveWon++;
    } else {
      stat.receiveRallies++;
      if (weWon) stat.receiveWon++;
    }
    // Rallies sem resolução (só `in_play` no fim) ficam contados no total
    // mas sem incrementar `won` — neutros.
    void weLost;
  }

  for (const stat of buckets.values()) {
    stat.sideOutPct = stat.receiveRallies
      ? round1((stat.receiveWon / stat.receiveRallies) * 100)
      : 0;
    stat.breakPointPct = stat.serveRallies
      ? round1((stat.serveWon / stat.serveRallies) * 100)
      : 0;
  }

  return Array.from(buckets.values());
}

// ── Heatmaps ────────────────────────────────────────────────────────────
function buildHeatmap(
  rows: ActionRow[],
  type: "attack" | "serve" | "reception",
): Heatmap {
  const filtered = rows.filter(
    (a) => a.type === type && a.zoneTo != null && a.zoneTo >= 1 && a.zoneTo <= 9,
  );
  const byZone = new Map<number, { count: number; kills: number }>();
  for (const a of filtered) {
    const z = a.zoneTo!;
    const cur = byZone.get(z) ?? { count: 0, kills: 0 };
    cur.count++;
    if (a.result === "kill" || a.result === "ace") cur.kills++;
    byZone.set(z, cur);
  }
  const zones: HeatmapZoneCount[] = [];
  let maxCount = 0;
  for (let z = 1; z <= 9; z++) {
    const v = byZone.get(z);
    const count = v?.count ?? 0;
    if (count > maxCount) maxCount = count;
    zones.push({
      zone: z,
      count,
      kills: type === "reception" ? undefined : v?.kills ?? 0,
    });
  }
  return { type, zones, total: filtered.length, maxCount };
}

// ── Setter distribution ─────────────────────────────────────────────────
function buildSetterDistribution(
  sortedRows: ActionRow[],
  rosterById: Map<string, Player>,
): SetterDistribution[] {
  // Para cada acção `set`, encontrar o próximo `attack` no mesmo rally e
  // creditar (setter -> attacker). Acções sem playerId são ignoradas.
  const setters = new Map<string, SetterDistribution>();
  const targetIndex = new Map<string, Map<string, SetterTarget>>();

  for (let i = 0; i < sortedRows.length; i++) {
    const set = sortedRows[i];
    if (set.type !== "set" || !set.playerId) continue;
    const setterPlayer = rosterById.get(set.playerId);
    if (!setterPlayer) continue;

    // Procura o próximo attack do mesmo rally (geralmente i+1, mas pode
    // haver outras acções a meio em logs imperfeitos — varremos até ao
    // próximo rallyId diferente).
    let attackAction: ActionRow | null = null;
    for (let j = i + 1; j < sortedRows.length; j++) {
      const next = sortedRows[j];
      if (next.rallyId !== set.rallyId) break;
      if (next.type === "attack") {
        attackAction = next;
        break;
      }
    }
    if (!attackAction || !attackAction.playerId) continue;
    const attackerPlayer = rosterById.get(attackAction.playerId);
    if (!attackerPlayer) continue;

    let bucket = setters.get(set.playerId);
    if (!bucket) {
      bucket = {
        setterId: set.playerId,
        setterName: `${setterPlayer.firstName} ${setterPlayer.lastName}`,
        setterNumber: setterPlayer.number,
        totalSets: 0,
        targets: [],
      };
      setters.set(set.playerId, bucket);
      targetIndex.set(set.playerId, new Map());
    }
    bucket.totalSets++;

    const targets = targetIndex.get(set.playerId)!;
    let t = targets.get(attackAction.playerId);
    if (!t) {
      t = {
        attackerId: attackAction.playerId,
        attackerName: `${attackerPlayer.firstName} ${attackerPlayer.lastName}`,
        attackerNumber: attackerPlayer.number,
        attackerPosition: attackerPlayer.position,
        count: 0,
        kills: 0,
      };
      targets.set(attackAction.playerId, t);
      bucket.targets.push(t);
    }
    t.count++;
    if (attackAction.result === "kill") t.kills++;
  }

  // Ordena targets por contagem desc, e setters por totalSets desc.
  for (const s of setters.values()) {
    s.targets.sort((a, b) => b.count - a.count);
  }
  return Array.from(setters.values()).sort(
    (a, b) => b.totalSets - a.totalSets,
  );
}

// ── Player training input ──────────────────────────────────────────────
/**
 * Scatter point com (x, y) em % do court (0..100). Mantemos `result` para
 * que o cliente possa colorir os pontos por tipo de resultado (kill, error,
 * etc.) — útil para distinguir tendências de eficácia, não só de volume.
 */
export interface ScatterPoint {
  x: number;
  y: number;
  result: string;
  matchId: string;
}

export interface PlayerZoneBreakdown {
  zone: number;
  count: number;
  /** % de kills sobre o total de ataques nessa zona (só faz sentido em ataque). */
  killPct: number;
}

export interface MatchHistoryEntry {
  matchId: string;
  date: string;
  opponent: string;
  setsWon: number;
  setsLost: number;
  actions: number;
  kills: number;
  attackAttempts: number;
  killPct: number;
  attackEff: number;
  passRating: number;
  aces: number;
  blocks: number;
  digs: number;
}

export interface TrendEntry {
  label: string;
  killPct: number;
  attackEff: number;
  passRating: number;
}

export interface PlayerSummary {
  player: Player;
  actions: number;
  kpis: TrainingRecommendationInput["kpis"];
  weaknesses: string[];
  /** Heatmap por zona DV (1-9) — ataques desta atleta. */
  attackHeatmap: Heatmap;
  /** Heatmap por zona DV (1-9) — saques desta atleta. */
  serveHeatmap: Heatmap;
  /** Heatmap por zona DV (1-9) — recepções desta atleta. */
  receptionHeatmap: Heatmap;
  /** Pontos precisos para scatter — pelo menos uma das coords presente. */
  attackPoints: ScatterPoint[];
  servePoints: ScatterPoint[];
  /** Top 3 zonas favoritas de ataque (por volume) com kill% por zona. */
  topAttackZones: PlayerZoneBreakdown[];
  /** Histórico jogo-a-jogo — últimos RECENT_LIMIT jogos em que participou. */
  matchHistory: MatchHistoryEntry[];
  /** Série temporal para gráfico de tendência — do mais antigo ao mais recente. */
  trend: TrendEntry[];
  /** KPIs médios da equipa nos mesmos jogos recentes, para comparação. */
  teamKpis: TrainingRecommendationInput["kpis"];
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
    .select()
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

  // ── Heatmaps + scatter por atleta ───────────────────────────────────
  const attackHeatmap = buildHeatmap(recent, "attack");
  const serveHeatmap = buildHeatmap(recent, "serve");
  const receptionHeatmap = buildHeatmap(recent, "reception");

  const attackPoints: ScatterPoint[] = attacks
    .filter((a) => a.zoneToX != null && a.zoneToY != null)
    .map((a) => ({
      x: a.zoneToX!,
      y: a.zoneToY!,
      result: a.result,
      matchId: a.matchId,
    }));
  const servePoints: ScatterPoint[] = serves
    .filter((a) => a.zoneToX != null && a.zoneToY != null)
    .map((a) => ({
      x: a.zoneToX!,
      y: a.zoneToY!,
      result: a.result,
      matchId: a.matchId,
    }));

  // Top 3 zonas de ataque por volume — útil para o card "as suas zonas".
  const topAttackZones: PlayerZoneBreakdown[] = [...attackHeatmap.zones]
    .filter((z) => z.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((z) => ({
      zone: z.zone,
      count: z.count,
      killPct: z.count > 0 ? round1(((z.kills ?? 0) / z.count) * 100) : 0,
    }));

  // ── Histórico jogo-a-jogo ────────────────────────────────────────────
  // Agrupa as acções desta atleta por jogo e calcula KPIs por jogo.
  const sortedMatches = [...recentMatches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const matchHistory: MatchHistoryEntry[] = sortedMatches
    .map((m, i) => {
      const mine = all.filter((a) => a.matchId === m.id);
      if (!mine.length) return null;
      const atks = mine.filter((a) => a.type === "attack");
      const kls = atks.filter((a) => a.result === "kill").length;
      const aErr = atks.filter(
        (a) => a.result === "error" || a.result === "blocked",
      ).length;
      const recs = mine.filter((a) => a.type === "reception");
      const recPts = recs.reduce((acc, a) => {
        if (a.result === "perfect") return acc + 3;
        if (a.result === "good") return acc + 2;
        if (a.result === "poor") return acc + 1;
        return acc;
      }, 0);
      const mServes = mine.filter((a) => a.type === "serve");
      const mAces = mServes.filter((a) => a.result === "ace").length;
      const mBlocks = mine.filter(
        (a) => a.type === "block" && a.result === "stuff",
      ).length;
      const mDigs = mine.filter(
        (a) =>
          a.type === "dig" &&
          (a.result === "perfect" || a.result === "good"),
      ).length;
      const kPct = atks.length ? (kls / atks.length) * 100 : 0;
      const eff2 = atks.length ? (kls - aErr) / atks.length : 0;
      const pRating = recs.length ? recPts / recs.length : 0;
      return {
        matchId: m.id,
        date: m.date instanceof Date ? m.date.toISOString() : String(m.date),
        opponent: m.opponent,
        setsWon: m.setsWon,
        setsLost: m.setsLost,
        actions: mine.length,
        kills: kls,
        attackAttempts: atks.length,
        killPct: round1(kPct),
        attackEff: round3(eff2),
        passRating: round2(pRating),
        aces: mAces,
        blocks: mBlocks,
        digs: mDigs,
        label: `J-${sortedMatches.length - i}`,
      } as MatchHistoryEntry & { label: string };
    })
    .filter((x): x is MatchHistoryEntry & { label: string } => !!x);

  // Trend: do mais antigo ao mais recente para o gráfico.
  const trend: TrendEntry[] = matchHistory.map((h, i) => ({
    label: `J-${matchHistory.length - i}`,
    killPct: h.killPct,
    attackEff: h.attackEff,
    passRating: h.passRating,
  }));

  // ── KPIs médios da equipa (todos os jogadores, mesmos jogos recentes) ──
  // Nota: usamos helpers locais para evitar shadowing das funções do módulo.
  let teamAllActions: ActionRow[] = [];
  if (matchIds.size > 0) {
    teamAllActions = await db
      .select()
      .from(actions)
      .where(inArray(actions.matchId, Array.from(matchIds)));
  }
  const tAtks = teamAllActions.filter((a) => a.type === "attack");
  const tKills = tAtks.filter((a) => a.result === "kill").length;
  const tAtkErr = tAtks.filter(
    (a) => a.result === "error" || a.result === "blocked",
  ).length;
  const tRecs = teamAllActions.filter((a) => a.type === "reception");
  const tRecPts = tRecs.reduce((acc, a) => {
    if (a.result === "perfect") return acc + 3;
    if (a.result === "good") return acc + 2;
    if (a.result === "poor") return acc + 1;
    return acc;
  }, 0);
  const tServes = teamAllActions.filter((a) => a.type === "serve");
  const tAces = tServes.filter((a) => a.result === "ace").length;
  const teamKpis = {
    killPct: tAtks.length ? round1((tKills / tAtks.length) * 100) : 0,
    attackEff: tAtks.length ? round3((tKills - tAtkErr) / tAtks.length) : 0,
    passRating: tRecs.length ? round2(tRecPts / tRecs.length) : 0,
    serveAcePct: tServes.length ? round1((tAces / tServes.length) * 100) : 0,
    blocks: teamAllActions.filter(
      (a) => a.type === "block" && a.result === "stuff",
    ).length,
    digs: teamAllActions.filter(
      (a) =>
        a.type === "dig" &&
        (a.result === "perfect" || a.result === "good"),
    ).length,
  };

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
    attackHeatmap,
    serveHeatmap,
    receptionHeatmap,
    attackPoints,
    servePoints,
    topAttackZones,
    matchHistory,
    trend,
    teamKpis,
  };
}

// ── Agregados por jogadora para recomendações de substituição ────────────

export interface PlayerAggregate {
  playerId: string;
  matchesPlayed: number;
  attacks:    { total: number; kills: number; errors: number };
  serves:     { total: number; aces: number; errors: number };
  receptions: { total: number; perfect: number; good: number; poor: number; error: number };
}

export async function buildTeamPlayerAggregates(teamId: string): Promise<PlayerAggregate[]> {
  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.teamId, teamId));
  if (!allMatches.length) return [];

  const matchIds = allMatches.map((m) => m.id);
  const all = await db
    .select()
    .from(actions)
    .where(inArray(actions.matchId, matchIds));

  const byPlayer = new Map<string, {
    matchIds: Set<string>;
    attacks: { total: number; kills: number; errors: number };
    serves:  { total: number; aces: number; errors: number };
    receptions: { total: number; perfect: number; good: number; poor: number; error: number };
  }>();

  for (const a of all) {
    if (!a.playerId) continue;
    let b = byPlayer.get(a.playerId);
    if (!b) {
      b = {
        matchIds: new Set(),
        attacks:    { total: 0, kills: 0, errors: 0 },
        serves:     { total: 0, aces: 0, errors: 0 },
        receptions: { total: 0, perfect: 0, good: 0, poor: 0, error: 0 },
      };
      byPlayer.set(a.playerId, b);
    }
    b.matchIds.add(a.matchId);
    if (a.type === "attack") {
      b.attacks.total++;
      if (a.result === "kill") b.attacks.kills++;
      if (a.result === "error" || a.result === "blocked") b.attacks.errors++;
    } else if (a.type === "serve") {
      b.serves.total++;
      if (a.result === "ace") b.serves.aces++;
      if (a.result === "error") b.serves.errors++;
    } else if (a.type === "reception") {
      b.receptions.total++;
      if (a.result === "perfect") b.receptions.perfect++;
      else if (a.result === "good") b.receptions.good++;
      else if (a.result === "poor") b.receptions.poor++;
      else b.receptions.error++;
    }
  }

  return [...byPlayer.entries()].map(([playerId, b]) => ({
    playerId,
    matchesPlayed: b.matchIds.size,
    attacks: b.attacks,
    serves: b.serves,
    receptions: b.receptions,
  }));
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

// ── Proactive insights ────────────────────────────────────────────────────

export type InsightLevel = "positive" | "warning" | "alert" | "info";
export type InsightCategory = "team" | "player" | "rotation" | "trend";

export interface Insight {
  id: string;
  level: InsightLevel;
  category: InsightCategory;
  title: string;
  body: string;
}

export async function buildInsights(teamId: string): Promise<Insight[]> {
  const insights: Insight[] = [];

  // ── Fetch data ────────────────────────────────────────────────────────
  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.teamId, teamId))
    .orderBy(desc(matches.date));

  const finishedMatches = allMatches.filter((m) => m.status === "finished");
  if (finishedMatches.length < 2) return insights; // not enough data

  const allMatchIds = finishedMatches.map((m) => m.id);
  const allActions = await db
    .select()
    .from(actions)
    .where(inArray(actions.matchId, allMatchIds));

  const roster = await db.select().from(players).where(eq(players.teamId, teamId));
  const rosterById = new Map(roster.map((p) => [p.id, p]));

  const actionsByMatch = new Map<string, Action[]>();
  for (const m of finishedMatches) actionsByMatch.set(m.id, []);
  for (const a of allActions) {
    const bucket = actionsByMatch.get(a.matchId);
    if (bucket) bucket.push(a);
  }

  // ── 1. Win/loss streak ────────────────────────────────────────────────
  const recent5 = finishedMatches.slice(0, 5);
  let streak = 0;
  const firstResult = recent5[0]?.setsWon > recent5[0]?.setsLost ? "win" : "loss";
  for (const m of recent5) {
    const res = m.setsWon > m.setsLost ? "win" : "loss";
    if (res === firstResult) streak++;
    else break;
  }
  if (streak >= 3 && firstResult === "win") {
    insights.push({
      id: "streak-win",
      level: "positive",
      category: "team",
      title: `${streak} vitórias consecutivas`,
      body: `A equipa está em boa forma nas últimas ${streak} partidas. Aproveita o momento.`,
    });
  } else if (streak >= 2 && firstResult === "loss") {
    insights.push({
      id: "streak-loss",
      level: "alert",
      category: "team",
      title: `${streak} derrotas consecutivas`,
      body: `A equipa perdeu as últimas ${streak} partidas. Analisa o padrão e ajusta antes da próxima.`,
    });
  }

  // ── 2. Kill% trend (últimas 2 vs. anteriores) ────────────────────────
  if (finishedMatches.length >= 4) {
    const last2 = finishedMatches.slice(0, 2).map((m) => actionsByMatch.get(m.id) ?? []);
    const prev2 = finishedMatches.slice(2, 4).map((m) => actionsByMatch.get(m.id) ?? []);
    const killLast = killPct(last2.flat());
    const killPrev = killPct(prev2.flat());
    const delta = killLast - killPrev;
    if (delta <= -8) {
      insights.push({
        id: "kill-drop",
        level: "warning",
        category: "trend",
        title: `Kill% caiu ${Math.abs(round1(delta))} pp`,
        body: `Nas últimas 2 partidas o Kill% foi ${round1(killLast)}%, contra ${round1(killPrev)}% nas 2 anteriores.`,
      });
    } else if (delta >= 8) {
      insights.push({
        id: "kill-rise",
        level: "positive",
        category: "trend",
        title: `Kill% subiu ${round1(delta)} pp`,
        body: `Nas últimas 2 partidas o Kill% foi ${round1(killLast)}%, contra ${round1(killPrev)}% nas 2 anteriores.`,
      });
    }
  }

  // ── 3. Side-out trend ────────────────────────────────────────────────
  if (finishedMatches.length >= 4) {
    const last2 = finishedMatches.slice(0, 2).map((m) => actionsByMatch.get(m.id) ?? []);
    const prev2 = finishedMatches.slice(2, 4).map((m) => actionsByMatch.get(m.id) ?? []);
    const soLast = sideOutPct(last2.flat());
    const soPrev = sideOutPct(prev2.flat());
    const delta = soLast - soPrev;
    if (delta <= -10) {
      insights.push({
        id: "sideout-drop",
        level: "warning",
        category: "trend",
        title: `Side-Out% caiu ${Math.abs(round1(delta))} pp`,
        body: `Receção/organização em queda nas últimas 2 partidas: ${round1(soLast)}% vs ${round1(soPrev)}%.`,
      });
    }
  }

  // ── 4. Worst rotation ────────────────────────────────────────────────
  const rotStats = buildRotationStats(allActions);
  const rotWithReceive = rotStats.filter((r) => r.receiveRallies >= 5);
  if (rotWithReceive.length > 0) {
    const worst = rotWithReceive.reduce((a, b) =>
      a.sideOutPct < b.sideOutPct ? a : b,
    );
    if (worst.sideOutPct < 42) {
      insights.push({
        id: `rotation-weak-${worst.rotation}`,
        level: "warning",
        category: "rotation",
        title: `Rotação P${worst.rotation} fraca em receção`,
        body: `Side-Out de apenas ${worst.sideOutPct}% nesta rotação (${worst.receiveRallies} ações). Considera ajustar o libero ou a cobertura.`,
      });
    }
    const best = rotWithReceive.reduce((a, b) =>
      a.sideOutPct > b.sideOutPct ? a : b,
    );
    if (best.sideOutPct >= 70 && best.rotation !== worst.rotation) {
      insights.push({
        id: `rotation-strong-${best.rotation}`,
        level: "positive",
        category: "rotation",
        title: `Rotação P${best.rotation} excelente em receção`,
        body: `Side-Out de ${best.sideOutPct}% nesta rotação. Força a servir nesta posição quando possível.`,
      });
    }
  }

  // ── 5. Per-player serve error rate (últimas 3 partidas) ──────────────
  const recent3Matches = finishedMatches.slice(0, 3);
  if (recent3Matches.length >= 2) {
    const recent3Actions = recent3Matches.flatMap((m) => actionsByMatch.get(m.id) ?? []);
    const serveByPlayer = new Map<string, { total: number; errors: number }>();
    for (const a of recent3Actions) {
      if (a.type !== "serve" || !a.playerId) continue;
      const b = serveByPlayer.get(a.playerId) ?? { total: 0, errors: 0 };
      b.total++;
      if (a.result === "error") b.errors++;
      serveByPlayer.set(a.playerId, b);
    }
    for (const [pid, b] of serveByPlayer) {
      if (b.total < 6) continue;
      const errPct = (b.errors / b.total) * 100;
      if (errPct >= 28) {
        const p = rosterById.get(pid);
        const name = p ? `#${p.number} ${p.firstName}` : "Jogadora";
        insights.push({
          id: `serve-error-${pid}`,
          level: "warning",
          category: "player",
          title: `${name} com muitos erros de serviço`,
          body: `${round1(errPct)}% de erros em serviço nas últimas ${recent3Matches.length} partidas (${b.errors}/${b.total}). Pode precisar de ajuste técnico.`,
        });
      }
    }
  }

  // ── 6. Per-player attack efficiency (últimas 3 partidas) ─────────────
  if (recent3Matches.length >= 2) {
    const recent3Actions = recent3Matches.flatMap((m) => actionsByMatch.get(m.id) ?? []);
    const atkByPlayer = new Map<string, { total: number; kills: number; errors: number }>();
    for (const a of recent3Actions) {
      if (a.type !== "attack" || !a.playerId) continue;
      const b = atkByPlayer.get(a.playerId) ?? { total: 0, kills: 0, errors: 0 };
      b.total++;
      if (a.result === "kill") b.kills++;
      if (a.result === "error" || a.result === "blocked") b.errors++;
      atkByPlayer.set(a.playerId, b);
    }
    // Best attacker
    let bestPid = "";
    let bestEff = -Infinity;
    for (const [pid, b] of atkByPlayer) {
      if (b.total < 8) continue;
      const eff = (b.kills - b.errors) / b.total;
      if (eff > bestEff) { bestEff = eff; bestPid = pid; }
    }
    if (bestPid && bestEff >= 0.35) {
      const p = rosterById.get(bestPid);
      const name = p ? `#${p.number} ${p.firstName}` : "Jogadora";
      insights.push({
        id: `attack-hot-${bestPid}`,
        level: "positive",
        category: "player",
        title: `${name} em grande forma no ataque`,
        body: `Eficiência de ${round2(bestEff)} nas últimas ${recent3Matches.length} partidas. Aproveita para a usar nos momentos críticos.`,
      });
    }

    // Worst attacker
    let worstPid = "";
    let worstEff = Infinity;
    for (const [pid, b] of atkByPlayer) {
      if (b.total < 8) continue;
      const eff = (b.kills - b.errors) / b.total;
      if (eff < worstEff) { worstEff = eff; worstPid = pid; }
    }
    if (worstPid && worstEff <= -0.10 && worstPid !== bestPid) {
      const p = rosterById.get(worstPid);
      const name = p ? `#${p.number} ${p.firstName}` : "Jogadora";
      insights.push({
        id: `attack-cold-${worstPid}`,
        level: "warning",
        category: "player",
        title: `${name} em dificuldades no ataque`,
        body: `Eficiência de ${round2(worstEff)} nas últimas ${recent3Matches.length} partidas. Considera reduzir as distribuições para ela nos momentos tensos.`,
      });
    }
  }

  // ── 7. Pass rating overview ───────────────────────────────────────────
  const recentActions = finishedMatches.slice(0, 3).flatMap((m) => actionsByMatch.get(m.id) ?? []);
  const pr = passRating(recentActions);
  if (pr < 1.8 && recentActions.filter((a) => a.type === "reception").length >= 10) {
    insights.push({
      id: "pass-poor",
      level: "alert",
      category: "team",
      title: `Receção abaixo do nível (${round2(pr)})`,
      body: `O pass rating está em ${round2(pr)} nas últimas 3 partidas (referência: ≥ 2.0). Foca o treino na receção.`,
    });
  } else if (pr >= 2.5 && recentActions.filter((a) => a.type === "reception").length >= 10) {
    insights.push({
      id: "pass-excellent",
      level: "positive",
      category: "team",
      title: `Receção excelente (${round2(pr)})`,
      body: `Pass rating de ${round2(pr)} nas últimas 3 partidas. A equipa está a controlar bem a receção.`,
    });
  }

  // Limit to 5 most relevant insights (sort: alert > warning > positive > info)
  const order: InsightLevel[] = ["alert", "warning", "positive", "info"];
  insights.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  return insights.slice(0, 6);
}
