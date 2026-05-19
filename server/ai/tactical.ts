import Anthropic from "@anthropic-ai/sdk";

const AI_MOCK = process.env.AI_MOCK === "true" || !process.env.ANTHROPIC_API_KEY;

export interface TacticalSuggestion {
  type: "timeout" | "serve" | "sub" | "rotation" | "attack" | "defense";
  text: string;
  urgency: "high" | "medium" | "low";
}

export interface TacticalContext {
  opponent: string;
  setNumber: number;
  homeScore: number;
  awayScore: number;
  servingTeam: "home" | "away";
  rotation: number;
  recentActions: Array<{
    type: string;
    result: string;
    playerNumber?: number;
    zone?: string;
  }>;
  teamKillPctToday: number;
  teamSideOutPctToday: number;
  rotationSeasonSideOut: number | null;
  strugglingPlayers: Array<{ number: number; name: string; kills: number; total: number }>;
  opponentRun: number;
}

export async function getTacticalSuggestions(
  ctx: TacticalContext,
): Promise<TacticalSuggestion[]> {
  if (AI_MOCK) return mockSuggestions(ctx);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const system = `És o assistente tático de um treinador de voleibol de elite. Recebes o estado em tempo real do jogo e respondes com 2-3 sugestões táticas CURTAS e accionáveis em português de Portugal. Cada sugestão tem no máximo 12 palavras. Foca no que fazer AGORA. Sê direto. Nunca repitas o óbvio. Responde SEMPRE em JSON válido.`;

  const userLines = [
    `Jogo: Set ${ctx.setNumber} · vs ${ctx.opponent} · ${ctx.homeScore}-${ctx.awayScore} · ${ctx.servingTeam === "home" ? "Nós" : "Adversário"} a servir · Rotação ${ctx.rotation}`,
    "",
    ctx.opponentRun >= 3
      ? `⚠️ Adversário em série de ${ctx.opponentRun} pontos consecutivos.`
      : "",
    ctx.rotationSeasonSideOut !== null
      ? `Rotação ${ctx.rotation} (temporada): ${ctx.rotationSeasonSideOut}% side-out`
      : "",
    ctx.strugglingPlayers.length
      ? `Em dificuldade: ${ctx.strugglingPlayers.map((p) => `#${p.number} ${p.name} (${p.kills}/${p.total} ataques)`).join(", ")}`
      : "",
    "",
    `Últimas acções: ${ctx.recentActions
      .slice(-8)
      .map((a) => `${a.type} ${a.result}${a.zone ? ` zona${a.zone}` : ""}`)
      .join(" · ")}`,
    "",
    `Kill% hoje: ${ctx.teamKillPctToday}% · Side-out hoje: ${ctx.teamSideOutPctToday}%`,
    "",
    `Responde com JSON: { "suggestions": [{ "type": "timeout"|"serve"|"sub"|"rotation"|"attack"|"defense", "text": "...", "urgency": "high"|"medium"|"low" }] }`,
    "Máximo 3 sugestões. Prioriza urgência alta quando aplicável.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      temperature: 0.4,
      system,
      messages: [{ role: "user", content: userLines }],
    });

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fence ? fence[1] : text;
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return (parsed.suggestions ?? []).slice(0, 3) as TacticalSuggestion[];
  } catch {
    return mockSuggestions(ctx);
  }
}

function mockSuggestions(ctx: TacticalContext): TacticalSuggestion[] {
  const suggestions: TacticalSuggestion[] = [];
  if (ctx.opponentRun >= 3) {
    suggestions.push({
      type: "timeout",
      text: `Adversário em ${ctx.opponentRun} pontos seguidos — pede tempo!`,
      urgency: "high",
    });
  }
  if (ctx.rotationSeasonSideOut !== null && ctx.rotationSeasonSideOut < 45) {
    suggestions.push({
      type: "rotation",
      text: `Rotação ${ctx.rotation}: historicamente fraca (${ctx.rotationSeasonSideOut}%). Atenção ao bloco.`,
      urgency: "medium",
    });
  }
  if (ctx.strugglingPlayers.length) {
    const p = ctx.strugglingPlayers[0];
    suggestions.push({
      type: "sub",
      text: `#${p.number} ${p.name} com ${p.kills}/${p.total} ataques — considera substituição.`,
      urgency: "medium",
    });
  }
  if (!suggestions.length) {
    suggestions.push({
      type: "attack",
      text: "Mantém o ritmo — equipa a funcionar bem.",
      urgency: "low",
    });
  }
  return suggestions;
}
