
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
  return mockSuggestions(ctx);
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
