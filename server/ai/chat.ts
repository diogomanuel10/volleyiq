import { eq } from "drizzle-orm";
import { db } from "../db";
import { matches, players } from "@shared/schema";
import { buildDashboard, buildTeamPlayerAggregates } from "../stats";
import * as storage from "../storage";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

export async function teamChat(
  teamId: string,
  question: string,
  _history: ChatMessage[],
): Promise<{ answer: string; mock: boolean }> {
  const answer = await buildRuleBasedAnswer(teamId, question);
  return { answer, mock: false };
}

async function buildRuleBasedAnswer(teamId: string, question: string): Promise<string> {
  const team = await storage.getTeamById(teamId);
  const teamName = team?.name ?? "a equipa";
  const dashboard = await buildDashboard(teamId);
  const kpis = dashboard.kpis;

  const q = question.toLowerCase();

  // Rotation queries
  if (q.includes("rotação") || q.includes("rotacao") || q.includes("rotation")) {
    const withData = dashboard.rotationStats.filter((r) => r.receiveRallies > 0);
    if (!withData.length) {
      return `Ainda não há dados de rotação suficientes para ${teamName}. Regista mais partidas para obter esta análise.`;
    }
    const sorted = [...withData].sort((a, b) => b.sideOutPct - a.sideOutPct);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const lines = sorted.map(
      (r) => `• P${r.rotation}: Side-Out ${r.sideOutPct}%, Break ${r.serveRallies ? `${r.breakPointPct}%` : "—"}`,
    );
    return (
      `**Rotações de ${teamName}**\n\n` +
      lines.join("\n") +
      `\n\nMelhor rotação em side-out: **P${best.rotation}** (${best.sideOutPct}%)` +
      (sorted.length > 1 ? `\nRotação mais fraca: **P${worst.rotation}** (${worst.sideOutPct}%)` : "")
    );
  }

  // Attack / kill queries
  if (
    q.includes("ataque") ||
    q.includes("kill") ||
    q.includes("melhor forma") ||
    q.includes("atacante") ||
    q.includes("pontuar")
  ) {
    const playerAggregates = await buildTeamPlayerAggregates(teamId);
    const roster = await db.select().from(players).where(eq(players.teamId, teamId));
    const playerById = new Map(roster.map((p) => [p.id, p]));

    const attackers = playerAggregates
      .filter((a) => a.attacks.total >= 5)
      .map((a) => {
        const p = playerById.get(a.playerId);
        const killPct =
          a.attacks.total > 0
            ? Math.round((a.attacks.kills / a.attacks.total) * 100 * 10) / 10
            : 0;
        return { name: p ? `${p.firstName} ${p.lastName}` : "?", number: p?.number ?? 0, killPct, total: a.attacks.total };
      })
      .sort((a, b) => b.killPct - a.killPct);

    if (!attackers.length) {
      return `Kill% global de ${teamName}: **${kpis.killPct}%**. Ainda não há dados individuais suficientes (mínimo 5 ataques por jogadora).`;
    }

    const top3 = attackers.slice(0, 3);
    const lines = top3.map((a, i) => `${i + 1}. #${a.number} ${a.name} — Kill% ${a.killPct}% (${a.total} ataques)`);
    return (
      `**Ataque de ${teamName}** (Kill% global: ${kpis.killPct}%)\n\n` +
      `Top atacantes:\n${lines.join("\n")}` +
      (attackers.length > 3 ? `\n\n+${attackers.length - 3} jogadoras com dados registados.` : "")
    );
  }

  // Reception / pass queries
  if (
    q.includes("receção") ||
    q.includes("receção") ||
    q.includes("recepção") ||
    q.includes("passe") ||
    q.includes("pass") ||
    q.includes("libero") ||
    q.includes("líbero")
  ) {
    const playerAggregates = await buildTeamPlayerAggregates(teamId);
    const roster = await db.select().from(players).where(eq(players.teamId, teamId));
    const playerById = new Map(roster.map((p) => [p.id, p]));

    const passers = playerAggregates
      .filter((a) => a.receptions.total >= 5)
      .map((a) => {
        const p = playerById.get(a.playerId);
        const passRating =
          a.receptions.total > 0
            ? Math.round(
                ((a.receptions.perfect * 3 + a.receptions.good * 2 + a.receptions.poor * 1) /
                  a.receptions.total) *
                  100,
              ) / 100
            : 0;
        return { name: p ? `${p.firstName} ${p.lastName}` : "?", number: p?.number ?? 0, passRating, total: a.receptions.total };
      })
      .sort((a, b) => b.passRating - a.passRating);

    if (!passers.length) {
      return `Pass Rating médio de ${teamName}: **${kpis.passRating}**. Um valor acima de 2.0 indica boa qualidade. Ainda não há dados individuais suficientes.`;
    }

    const lines = passers.slice(0, 3).map((p, i) => `${i + 1}. #${p.number} ${p.name} — Pass Rating ${p.passRating} (${p.total} recepções)`);
    return (
      `**Receção de ${teamName}** (Pass Rating médio: ${kpis.passRating})\n\n` +
      `Melhores passadoras:\n${lines.join("\n")}` +
      `\n\n*Escala: 1.0 = fraco · 2.0 = bom · 3.0 = perfeito*`
    );
  }

  // Serve / ace queries
  if (q.includes("serviço") || q.includes("servico") || q.includes("ace") || q.includes("serve")) {
    const playerAggregates = await buildTeamPlayerAggregates(teamId);
    const roster = await db.select().from(players).where(eq(players.teamId, teamId));
    const playerById = new Map(roster.map((p) => [p.id, p]));

    const servers = playerAggregates
      .filter((a) => a.serves.total >= 5)
      .map((a) => {
        const p = playerById.get(a.playerId);
        const acePct =
          a.serves.total > 0
            ? Math.round((a.serves.aces / a.serves.total) * 100 * 10) / 10
            : 0;
        return { name: p ? `${p.firstName} ${p.lastName}` : "?", number: p?.number ?? 0, acePct, aces: a.serves.aces, total: a.serves.total };
      })
      .sort((a, b) => b.acePct - a.acePct);

    if (!servers.length) {
      return `Ace% global de ${teamName}: **${kpis.serveAcePct}%**. Ainda não há dados individuais suficientes (mínimo 5 serviços por jogadora).`;
    }

    const lines = servers.slice(0, 3).map((s, i) => `${i + 1}. #${s.number} ${s.name} — Ace% ${s.acePct}% (${s.aces} aces em ${s.total} serviços)`);
    return (
      `**Serviço de ${teamName}** (Ace% global: ${kpis.serveAcePct}%)\n\n` +
      `Melhores servidoras:\n${lines.join("\n")}`
    );
  }

  // Results / match queries
  if (
    q.includes("result") ||
    q.includes("partida") ||
    q.includes("jogo") ||
    q.includes("vitória") ||
    q.includes("derrota") ||
    q.includes("balanço") ||
    q.includes("balanco")
  ) {
    const allMatches = await db.select().from(matches).where(eq(matches.teamId, teamId));
    const finished = allMatches.filter((m) => m.status === "finished");
    const wins = finished.filter((m) => m.setsWon > m.setsLost).length;
    const losses = finished.filter((m) => m.setsLost > m.setsWon).length;

    if (!finished.length) {
      return `Ainda não há partidas terminadas registadas para ${teamName}.`;
    }

    const recent = finished
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((m) => {
        const won = m.setsWon > m.setsLost;
        return `• ${fmtDate(m.date)} vs ${m.opponent}: ${m.setsWon}-${m.setsLost} ${won ? "✓" : "✗"}`;
      });

    return (
      `**Resultados de ${teamName}**\n\n` +
      `Balanço: **${wins} vitórias — ${losses} derrotas**\n\n` +
      `Últimas partidas:\n${recent.join("\n")}`
    );
  }

  // Side-out specific query
  if (q.includes("side-out") || q.includes("sideout") || q.includes("receção side") || q.includes("receber")) {
    return (
      `**Side-Out de ${teamName}** (últimas 6 partidas)\n\n` +
      `Side-Out%: **${kpis.sideOutPct}%**\n\n` +
      `Um valor acima de 55% é considerado bom a nível competitivo. Consulta os detalhes por rotação para identificar onde há margem de melhoria.`
    );
  }

  // General / fallback — show KPI summary
  return (
    `**Resumo de ${teamName}** (últimas 6 partidas)\n\n` +
    `• Kill%: **${kpis.killPct}%**\n` +
    `• Side-Out%: **${kpis.sideOutPct}%**\n` +
    `• Pass Rating: **${kpis.passRating}**\n` +
    `• Ace%: **${kpis.serveAcePct}%**\n` +
    `• Attack Efficiency: **${kpis.attackEfficiency}**\n\n` +
    `Podes perguntar sobre rotações, ataque, receção, serviço ou resultados para mais detalhe.`
  );
}
