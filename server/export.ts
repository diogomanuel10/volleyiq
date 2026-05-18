/**
 * Geração de workbook XLSX com dados completos da equipa.
 * 5 sheets: Resumo, Partidas, Acções, Jogadoras, Rotações.
 */

import * as XLSX from "xlsx";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { actions, matches, players } from "@shared/schema";
import type { Action, Match, Player } from "@shared/schema";
import { buildRotationStats } from "./stats";

function killPct(rows: Action[]): number {
  const atks = rows.filter((a) => a.type === "attack");
  if (!atks.length) return 0;
  return Math.round((atks.filter((a) => a.result === "kill").length / atks.length) * 1000) / 10;
}

function sideOutPct(rows: Action[]): number {
  const rec = rows.filter((a) => a.type === "reception");
  if (!rec.length) return 0;
  const positive = rec.filter((a) => a.result !== "error").length;
  return Math.round((positive / rec.length) * 1000) / 10;
}

function passRating(rows: Action[]): number {
  const rec = rows.filter((a) => a.type === "reception");
  if (!rec.length) return 0;
  const sum = rec.reduce((s, a) => {
    if (a.result === "perfect") return s + 3;
    if (a.result === "good")    return s + 2;
    if (a.result === "poor")    return s + 1;
    return s;
  }, 0);
  return Math.round((sum / rec.length) * 100) / 100;
}

function serveAcePct(rows: Action[]): number {
  const serves = rows.filter((a) => a.type === "serve");
  if (!serves.length) return 0;
  return Math.round((serves.filter((a) => a.result === "ace").length / serves.length) * 1000) / 10;
}

function attackEff(rows: Action[]): number {
  const atks = rows.filter((a) => a.type === "attack");
  if (!atks.length) return 0;
  const kills  = atks.filter((a) => a.result === "kill").length;
  const errors = atks.filter((a) => a.result === "error" || a.result === "blocked").length;
  return Math.round(((kills - errors) / atks.length) * 1000) / 1000;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("pt-PT");
}

export async function buildExportWorkbook(teamId: string): Promise<Buffer> {
  // ── Fetch all data ────────────────────────────────────────────────────
  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.teamId, teamId))
    .orderBy(desc(matches.date));

  const roster = await db
    .select()
    .from(players)
    .where(eq(players.teamId, teamId));

  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const matchById  = new Map(allMatches.map((m) => [m.id, m]));

  const allActions: Action[] = allMatches.length
    ? await db.select().from(actions).where(
        inArray(actions.matchId, allMatches.map((m) => m.id)),
      )
    : [];

  const actionsByMatch = new Map<string, Action[]>();
  for (const m of allMatches) actionsByMatch.set(m.id, []);
  for (const a of allActions) {
    const bucket = actionsByMatch.get(a.matchId);
    if (bucket) bucket.push(a);
  }

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Resumo ───────────────────────────────────────────────────
  const finished = allMatches.filter((m) => m.status === "finished");
  const wins   = finished.filter((m) => m.setsWon > m.setsLost).length;
  const losses = finished.filter((m) => m.setsLost > m.setsWon).length;

  const resumoData = [
    ["Métrica", "Valor"],
    ["Total de partidas (terminadas)", finished.length],
    ["Vitórias", wins],
    ["Derrotas", losses],
    ["Kill %", killPct(allActions) + "%"],
    ["Side-Out %", sideOutPct(allActions) + "%"],
    ["Pass Rating", passRating(allActions)],
    ["Serve Ace %", serveAcePct(allActions) + "%"],
    ["Eficiência de ataque", attackEff(allActions)],
    ["Total de acções registadas", allActions.length],
    ["Gerado em", new Date().toLocaleString("pt-PT")],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch: 36 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // ── Sheet 2: Partidas ─────────────────────────────────────────────────
  const partidasHeader = [
    "Data", "Adversário", "Competição", "Sets Ganhos", "Sets Perdidos",
    "Resultado", "Kill %", "Side-Out %", "Pass Rating", "Acções",
  ];
  const partidasRows = allMatches.map((m) => {
    const mActions = actionsByMatch.get(m.id) ?? [];
    return [
      fmtDate(m.date),
      m.opponent,
      m.competition ?? "",
      m.setsWon,
      m.setsLost,
      m.setsWon > m.setsLost ? "Vitória" : m.setsLost > m.setsWon ? "Derrota" : "—",
      killPct(mActions) + "%",
      sideOutPct(mActions) + "%",
      passRating(mActions),
      mActions.length,
    ];
  });
  const wsPartidas = XLSX.utils.aoa_to_sheet([partidasHeader, ...partidasRows]);
  wsPartidas["!cols"] = [10, 22, 18, 14, 14, 10, 10, 12, 12, 10].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsPartidas, "Partidas");

  // ── Sheet 3: Acções ───────────────────────────────────────────────────
  const accoesHeader = [
    "Data", "Adversário", "Set", "Rotação",
    "Nº Jogadora", "Nome", "Posição", "Lado",
    "Tipo", "Resultado", "Zona Origem", "Zona Destino",
  ];
  const RESULT_PT: Record<string, string> = {
    kill: "Kill", error: "Erro", ace: "Ace", tooled: "Tooled",
    in_play: "Em jogo", perfect: "Perfeito", good: "Bom", poor: "Fraco",
    blocked: "Bloqueado", stuff: "Stuff", touch: "Toque", won: "Ponto ganho", lost: "Ponto adversário",
  };
  const TYPE_PT: Record<string, string> = {
    serve: "Serviço", reception: "Receção", set: "Distribuição",
    attack: "Ataque", block: "Bloco", dig: "Defesa", freeball: "Freeball",
  };
  const accoesRows = allActions.map((a) => {
    const match = matchById.get(a.matchId);
    const player = a.playerId ? rosterById.get(a.playerId) : null;
    return [
      fmtDate(match?.date ?? null),
      match?.opponent ?? "",
      a.setNumber ?? "",
      a.rotation ?? "",
      player?.number ?? "",
      player ? `${player.firstName} ${player.lastName}` : "(adversário)",
      player?.position ?? "",
      a.side === "home" ? "Casa" : "Fora",
      TYPE_PT[a.type] ?? a.type,
      RESULT_PT[a.result] ?? a.result,
      a.zoneFrom ?? "",
      a.zoneTo ?? "",
    ];
  });
  const wsAccoes = XLSX.utils.aoa_to_sheet([accoesHeader, ...accoesRows]);
  wsAccoes["!cols"] = [10, 18, 5, 8, 10, 22, 10, 8, 14, 16, 12, 12].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsAccoes, "Acções");

  // ── Sheet 4: Jogadoras ────────────────────────────────────────────────
  const jogHeader = [
    "Nº", "Nome", "Posição", "Partidas",
    "Ataques", "Kills", "Erros Ataque", "Kill %", "Eficiência Ataque",
    "Serviços", "Aces", "Erros Serviço", "Ace %",
    "Receções", "Perfeitas", "Boas", "Fracas", "Erros Rec.", "Pass Rating",
  ];

  const byPlayer = new Map<string, {
    player: Player;
    matchIds: Set<string>;
    atk: { total: number; kills: number; errors: number };
    srv: { total: number; aces: number; errors: number };
    rec: { total: number; perfect: number; good: number; poor: number; error: number };
  }>();

  for (const a of allActions) {
    if (!a.playerId) continue;
    let b = byPlayer.get(a.playerId);
    if (!b) {
      const p = rosterById.get(a.playerId);
      if (!p) continue;
      b = {
        player: p,
        matchIds: new Set(),
        atk: { total: 0, kills: 0, errors: 0 },
        srv: { total: 0, aces: 0, errors: 0 },
        rec: { total: 0, perfect: 0, good: 0, poor: 0, error: 0 },
      };
      byPlayer.set(a.playerId, b);
    }
    b.matchIds.add(a.matchId);
    if (a.type === "attack") {
      b.atk.total++;
      if (a.result === "kill") b.atk.kills++;
      if (a.result === "error" || a.result === "blocked") b.atk.errors++;
    } else if (a.type === "serve") {
      b.srv.total++;
      if (a.result === "ace")   b.srv.aces++;
      if (a.result === "error") b.srv.errors++;
    } else if (a.type === "reception") {
      b.rec.total++;
      if (a.result === "perfect") b.rec.perfect++;
      else if (a.result === "good") b.rec.good++;
      else if (a.result === "poor") b.rec.poor++;
      else b.rec.error++;
    }
  }

  // Include all roster players, even those with no actions
  for (const p of roster) {
    if (!byPlayer.has(p.id)) {
      byPlayer.set(p.id, {
        player: p,
        matchIds: new Set(),
        atk: { total: 0, kills: 0, errors: 0 },
        srv: { total: 0, aces: 0, errors: 0 },
        rec: { total: 0, perfect: 0, good: 0, poor: 0, error: 0 },
      });
    }
  }

  const jogRows = [...byPlayer.values()]
    .sort((a, b) => a.player.number - b.player.number)
    .map(({ player: p, matchIds, atk, srv, rec }) => {
      const killP = atk.total ? Math.round((atk.kills / atk.total) * 1000) / 10 : 0;
      const eff   = atk.total ? Math.round(((atk.kills - atk.errors) / atk.total) * 1000) / 1000 : 0;
      const aceP  = srv.total ? Math.round((srv.aces  / srv.total)  * 1000) / 10 : 0;
      const prSum = rec.perfect * 3 + rec.good * 2 + rec.poor * 1;
      const pr    = rec.total ? Math.round((prSum / rec.total) * 100) / 100 : 0;
      return [
        p.number, `${p.firstName} ${p.lastName}`, p.position, matchIds.size,
        atk.total, atk.kills, atk.errors, killP, eff,
        srv.total, srv.aces, srv.errors, aceP,
        rec.total, rec.perfect, rec.good, rec.poor, rec.error, pr,
      ];
    });

  const wsJog = XLSX.utils.aoa_to_sheet([jogHeader, ...jogRows]);
  wsJog["!cols"] = [5, 22, 8, 8, 8, 8, 12, 8, 12, 8, 6, 12, 8, 8, 10, 6, 8, 10, 12].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsJog, "Jogadoras");

  // ── Sheet 5: Rotações ─────────────────────────────────────────────────
  const rotHeader = [
    "Rotação", "Total Rallies", "Rallies em Receção", "Side-Out %",
    "Rallies em Serviço", "Break-Point %",
  ];
  const rotStats = buildRotationStats(allActions);
  const rotRows = rotStats.map((r) => [
    `P${r.rotation}`,
    r.totalRallies,
    r.receiveRallies,
    r.receiveRallies ? r.sideOutPct + "%" : "—",
    r.serveRallies,
    r.serveRallies ? r.breakPointPct + "%" : "—",
  ]);
  const wsRot = XLSX.utils.aoa_to_sheet([rotHeader, ...rotRows]);
  wsRot["!cols"] = [10, 14, 18, 12, 18, 14].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsRot, "Rotações");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
