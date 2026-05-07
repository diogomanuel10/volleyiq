import type { Player } from "@shared/schema";
import type { Side } from "@/hooks/useScoutState";

/**
 * Dado um lineup base (6 slots P1..P6), a rotação actual e os dois líberos,
 * devolve os 6 slots *efectivos* em campo — com o líbero no lugar do central
 * (MB) que está actualmente na linha de trás.
 *
 * Convenção de rotação (volley FIVB — sentido horário, R diminui):
 *   Sequência: 1 → 6 → 5 → 4 → 3 → 2 → 1.
 *   A posição de court P (1-based, DV) é ocupada pelo jogador em
 *   baseSlots[(P - rotation + 6) % 6].
 *
 *   Verificação: rotação 1, P=1 → slot[0] (P1 inicial). Após 1 rotação, R=6
 *   e P=1 → slot[1] (era P2 — agora serve, está no fundo direito).
 *
 * Posições de trás (DV): 1 (back-direita), 5 (back-esquerda), 6 (back-centro).
 *
 * O líbero não faz parte dos 6 slots base — é um 7.º jogador separado.
 */
export function getEffectiveLineup(
  baseSlots: (Player | null)[],            // índices 0-5 = P1..P6 guardados
  rotation: number,                         // 1..6
  servingTeam: Side,
  allPlayersById: Map<string, Player>,
  liberoReceptionId: string | null | undefined,
  liberoDefenseId: string | null | undefined,
): (Player | null)[] {
  // Líbero activo depende de quem serve.
  const liberoId = servingTeam === "away"
    ? liberoReceptionId   // adversário serve → recebemos → líbero de receção
    : liberoDefenseId;    // nós servimos → defesa → líbero de defesa

  if (!liberoId) return [...baseSlots];

  const libero = allPlayersById.get(liberoId);
  if (!libero) return [...baseSlots];

  // Posições de trás onde o líbero pode substituir o central.
  // P1 (back-direita) só é excluída quando NÓS servimos — o jogador em P1
  // é o servidor e a líbero não pode servir (regra FIVB). Quando o adversário
  // serve (receção), o MB em P1 está só a receber e a líbero entra normalmente.
  const BACK_POSITIONS: readonly number[] =
    servingTeam === "away"
      ? [1, 5, 6]   // receção: líbero cobre os três back-row slots
      : [5, 6];     // serviço: P1 serve, não pode ser substituída pela líbero

  // Para cada posição de trás, verifica se o jogador lá é MB.
  // Fórmula: courtPos P na rotação R → slot[(P - R + 6) % 6].
  for (const courtPos of BACK_POSITIONS) {
    const slotIdx = (courtPos - rotation + 6) % 6;
    const player = baseSlots[slotIdx];
    if (player?.position === "MB") {
      // Troca este MB pelo líbero.
      const result = [...baseSlots];
      result[slotIdx] = libero;
      return result;
    }
  }

  // Nenhum MB na linha de trás (p.ex. MB chegou à frente) — não troca.
  return [...baseSlots];
}

/** Devolve o líbero activo para o contexto actual de serviço. */
export function getActiveLiberoId(
  servingTeam: Side,
  liberoReceptionId: string | null | undefined,
  liberoDefenseId: string | null | undefined,
): string | null {
  return (servingTeam === "away" ? liberoReceptionId : liberoDefenseId) ?? null;
}
