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

const TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    suggestions: {
      type: "array",
      description: "2 to 3 tactical suggestions, highest urgency first",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["timeout", "serve", "sub", "rotation", "attack", "defense"],
          },
          text: {
            type: "string",
            description: "Max 12 words. Direct, actionable, in Portuguese.",
          },
          urgency: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["type", "text", "urgency"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 3,
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
};

export async function getTacticalSuggestions(
  ctx: TacticalContext,
): Promise<TacticalSuggestion[]> {
  if (AI_MOCK) return mockSuggestions(ctx);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const system = `És o assistente tático de um treinador de voleibol de elite. Recebes o estado em tempo real do jogo e respondes com 2-3 sugestões táticas CURTAS e accionáveis em português de Portugal. Cada sugestão tem no máximo 12 palavras. Foca no que fazer AGORA. Sê direto. Nunca repitas o óbvio.`;

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
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system,
      tools: [
        {
          name: "report_suggestions",
          description: "Report 2-3 real-time tactical suggestions for the coach",
          input_schema: TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: "report_suggestions" },
      messages: [{ role: "user", content: userLines }],
    });

    const toolBlock = resp.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolBlock) throw new Error("no tool_use block");

    const data = toolBlock.input as { suggestions: TacticalSuggestion[] };
    return (data.suggestions ?? []).slice(0, 3);
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
