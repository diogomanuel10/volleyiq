import Anthropic from "@anthropic-ai/sdk";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { actions, matches, players } from "@shared/schema";
import { buildDashboard, buildTeamPlayerAggregates } from "../stats";
import * as storage from "../storage";

const AI_MOCK =
  process.env.AI_MOCK === "true" || !process.env.ANTHROPIC_API_KEY;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

async function buildSystemPrompt(teamId: string): Promise<string> {
  // Fetch team info
  const team = await storage.getTeamById(teamId);
  const teamName = team?.name ?? teamId;

  // Fetch all finished matches
  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.teamId, teamId));
  const finished = allMatches.filter((m) => m.status === "finished");
  const wins = finished.filter((m) => m.setsWon > m.setsLost).length;
  const losses = finished.filter((m) => m.setsLost > m.setsWon).length;

  // Build match results section
  const matchLines = finished
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20)
    .map((m) => {
      const won = m.setsWon > m.setsLost;
      return `- vs ${m.opponent} (${fmtDate(m.date)}): ${m.setsWon}-${m.setsLost} ${won ? "✓" : "✗"}`;
    });

  // Fetch all players
  const roster = await db
    .select()
    .from(players)
    .where(eq(players.teamId, teamId));

  // Get dashboard stats (KPIs, rotation, trend)
  const dashboard = await buildDashboard(teamId);

  // Get per-player aggregates
  const playerAggregates = await buildTeamPlayerAggregates(teamId);
  const playerById = new Map(roster.map((p) => [p.id, p]));

  // Build player lines
  const playerLines = playerAggregates
    .map((agg) => {
      const p = playerById.get(agg.playerId);
      if (!p) return null;
      const killPct =
        agg.attacks.total > 0
          ? Math.round((agg.attacks.kills / agg.attacks.total) * 100 * 10) / 10
          : null;
      const acePct =
        agg.serves.total > 0
          ? Math.round((agg.serves.aces / agg.serves.total) * 100 * 10) / 10
          : null;
      const passRating =
        agg.receptions.total > 0
          ? Math.round(
              ((agg.receptions.perfect * 3 +
                agg.receptions.good * 2 +
                agg.receptions.poor * 1) /
                agg.receptions.total) *
                100,
            ) / 100
          : null;
      const status = p.active ? "" : " (inativa)";
      const parts: string[] = [];
      if (agg.attacks.total > 0)
        parts.push(
          `${agg.attacks.total} ataques${killPct !== null ? `, Kill%=${killPct}%` : ""}`,
        );
      if (agg.serves.total > 0)
        parts.push(
          `${agg.serves.total} serviços${acePct !== null ? `, Ace%=${acePct}%` : ""}`,
        );
      if (agg.receptions.total > 0)
        parts.push(
          `${agg.receptions.total} recepções${passRating !== null ? `, Pass=${passRating}` : ""}`,
        );
      return `#${p.number} ${p.firstName} ${p.lastName} (${p.position})${status}: ${parts.join(", ")}`;
    })
    .filter((x): x is string => !!x);

  // Build rotation lines
  const rotationLines = dashboard.rotationStats.map(
    (r) =>
      `P${r.rotation}: Side-Out ${r.receiveRallies ? `${r.sideOutPct}%` : "—"}, Break ${r.serveRallies ? `${r.breakPointPct}%` : "—"}`,
  );

  // Global KPIs
  const kpis = dashboard.kpis;

  const lines = [
    "És um analista de voleibol especialista. Tens acesso aos dados reais da equipa e respondes SEMPRE em português de Portugal.",
    "Sê conciso e direto. Usa números sempre que possível. Não inventes dados que não estejam no contexto.",
    "",
    "=== CONTEXTO DA EQUIPA ===",
    `Equipa: ${teamName}`,
    `Balanço: ${wins} vitórias — ${losses} derrotas`,
    "",
    `RESULTADOS (${finished.length} partidas terminadas, últimas 20):`,
    ...(matchLines.length ? matchLines : ["- Sem partidas registadas."]),
    "",
    "KPIs GLOBAIS (últimas 6 partidas):",
    `- Kill%: ${kpis.killPct}%`,
    `- Side-Out%: ${kpis.sideOutPct}%`,
    `- Pass Rating: ${kpis.passRating}`,
    `- Serve Ace%: ${kpis.serveAcePct}%`,
    `- Attack Efficiency: ${kpis.attackEfficiency}`,
    "",
    "JOGADORAS:",
    ...(playerLines.length
      ? playerLines
      : ["- Sem jogadoras com acções registadas."]),
    "",
    "ROTAÇÕES (receção / break):",
    ...(rotationLines.length ? rotationLines : ["- Sem dados de rotação."]),
  ];

  return lines.join("\n");
}

export async function teamChat(
  teamId: string,
  question: string,
  history: ChatMessage[],
): Promise<{ answer: string; mock: boolean }> {
  if (AI_MOCK) {
    return { answer: await buildMockAnswer(teamId, question), mock: true };
  }

  const systemPrompt = await buildSystemPrompt(teamId);

  const client = new Anthropic();

  const trimmedHistory = history.slice(-10);

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: systemPrompt,
    messages: [
      ...trimmedHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: question },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (block && block.type === "text") return { answer: block.text, mock: false };
  return { answer: "Não foi possível gerar uma resposta.", mock: false };
}

async function buildMockAnswer(teamId: string, question: string): Promise<string> {
  const team = await storage.getTeamById(teamId);
  const dashboard = await buildDashboard(teamId);
  const kpis = dashboard.kpis;
  const teamName = team?.name ?? "a equipa";

  const q = question.toLowerCase();

  if (q.includes("rotação") || q.includes("rotation")) {
    const best = dashboard.rotationStats
      .filter((r) => r.receiveRallies > 0)
      .sort((a, b) => b.sideOutPct - a.sideOutPct)[0];
    if (best) {
      return `[Modo demo — configure ANTHROPIC_API_KEY para respostas reais]\n\nCom base nos dados de ${teamName}, a melhor rotação em side-out é a P${best.rotation} com ${best.sideOutPct}%.`;
    }
  }

  if (q.includes("kill") || q.includes("ataque") || q.includes("melhor forma")) {
    return `[Modo demo — configure ANTHROPIC_API_KEY para respostas reais]\n\nO Kill% global de ${teamName} nas últimas partidas é ${kpis.killPct}%. Consulte o separador de jogadoras para ver quem lidera.`;
  }

  if (q.includes("receção") || q.includes("passe") || q.includes("recepção")) {
    return `[Modo demo — configure ANTHROPIC_API_KEY para respostas reais]\n\nO Pass Rating médio de ${teamName} é ${kpis.passRating}. Um valor acima de 2.0 indica boa qualidade de passe.`;
  }

  return `[Modo demo — configure ANTHROPIC_API_KEY para respostas reais]\n\nDados actuais de ${teamName}: Kill% ${kpis.killPct}%, Side-out ${kpis.sideOutPct}%, Pass ${kpis.passRating}, Ace% ${kpis.serveAcePct}%.`;
}
