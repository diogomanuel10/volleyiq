import { eq, and, desc, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./db";
import {
  teams,
  memberships,
  players,
  matches,
  actions,
  checklistItems,
  trainingLogs,
  opponentTeams,
  opponentPlayers,
  opponentCoaches,
  type InsertTeam,
  type InsertPlayer,
  type InsertMatch,
  type InsertAction,
  type InsertOpponentTeam,
  type InsertOpponentPlayer,
  type InsertOpponentCoach,
} from "@shared/schema";
import type {
  TrainingPriority,
  TrainingRecommendation,
} from "@shared/types";
import {
  mirrorAction,
  mirrorChecklistItem,
  mirrorDeleteAction,
} from "./firestore";

/**
 * Camada fina de acesso a dados. Cada função respeita `teamId` como
 * fronteira de tenancy — nunca devolve linhas de outra equipa.
 */

const newId = () => nanoid(12);

// ── Teams ────────────────────────────────────────────────────────────────
export async function listTeamsForUser(uid: string) {
  const rows = await db
    .select({ team: teams })
    .from(memberships)
    .innerJoin(teams, eq(memberships.teamId, teams.id))
    .where(eq(memberships.uid, uid));
  return rows.map((r) => r.team);
}

export async function createTeam(uid: string, data: InsertTeam) {
  const id = newId();
  await db.insert(teams).values({ ...data, id, ownerUid: uid });
  await db.insert(memberships).values({
    id: newId(),
    teamId: id,
    uid,
    role: "owner",
  });
  const [row] = await db.select().from(teams).where(eq(teams.id, id));
  return row!;
}

export async function userBelongsToTeam(uid: string, teamId: string) {
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.uid, uid), eq(memberships.teamId, teamId)))
    .limit(1);
  return !!row;
}

export async function updateTeamPlan(
  teamId: string,
  plan: "basic" | "pro" | "club",
) {
  await db.update(teams).set({ plan }).where(eq(teams.id, teamId));
  const [row] = await db.select().from(teams).where(eq(teams.id, teamId));
  return row;
}

// ── Players ──────────────────────────────────────────────────────────────
export async function listPlayers(teamId: string) {
  return db.select().from(players).where(eq(players.teamId, teamId));
}

export async function getPlayer(teamId: string, id: string) {
  const [row] = await db
    .select()
    .from(players)
    .where(and(eq(players.teamId, teamId), eq(players.id, id)));
  return row;
}

export async function createPlayer(data: InsertPlayer) {
  const id = newId();
  await db.insert(players).values({ ...data, id });
  const [row] = await db.select().from(players).where(eq(players.id, id));
  return row;
}

/**
 * Insere vários jogadores para uma equipa numa única transacção. Devolve os
 * registos recém-criados. Não faz deduplicação por número — deixa o caller
 * (UI) avisar o utilizador sobre duplicados antes de confirmar o import.
 */
export async function bulkCreatePlayers(
  teamId: string,
  payload: Array<Omit<InsertPlayer, "teamId">>,
) {
  if (payload.length === 0) return [];
  const rows = payload.map((p) => ({ ...p, teamId, id: newId() }));
  await db.insert(players).values(rows);
  const ids = rows.map((r) => r.id);
  return db
    .select()
    .from(players)
    .where(and(eq(players.teamId, teamId), inArray(players.id, ids)));
}

export async function updatePlayer(
  teamId: string,
  id: string,
  data: Partial<InsertPlayer>,
) {
  await db
    .update(players)
    .set(data)
    .where(and(eq(players.teamId, teamId), eq(players.id, id)));
  return getPlayer(teamId, id);
}

export async function deletePlayer(teamId: string, id: string) {
  await db
    .delete(players)
    .where(and(eq(players.teamId, teamId), eq(players.id, id)));
}

// ── Matches ──────────────────────────────────────────────────────────────
export async function listMatches(teamId: string) {
  return db
    .select()
    .from(matches)
    .where(eq(matches.teamId, teamId))
    .orderBy(desc(matches.date));
}

export async function getMatch(teamId: string, id: string) {
  const [row] = await db
    .select()
    .from(matches)
    .where(and(eq(matches.teamId, teamId), eq(matches.id, id)));
  return row;
}

export async function createMatch(data: InsertMatch) {
  const id = newId();
  await db.insert(matches).values({ ...data, id });
  const [row] = await db.select().from(matches).where(eq(matches.id, id));
  return row;
}

/**
 * Bulk insert de jogos (calendário da época). Devolve os registos criados
 * ordenados por data descendente. Sem deduplicação no servidor — a UI
 * avisa sobre colisões antes do submit.
 *
 * Auto-link: se um jogo chegou sem `opponentTeamId` mas o texto `opponent`
 * bate certo (case-insensitive) com o nome de uma equipa no catálogo,
 * associamos automaticamente. Útil quando o utilizador já tem adversários
 * catalogados e importa o calendário por CSV.
 */
export async function bulkCreateMatches(
  teamId: string,
  payload: Array<Omit<InsertMatch, "teamId">>,
) {
  if (payload.length === 0) return [];
  const catalogue = await listOpponentTeams(teamId);
  const byName = new Map<string, string>();
  for (const o of catalogue) {
    byName.set(o.name.trim().toLowerCase(), o.id);
  }
  const rows = payload.map((m) => {
    const oppId =
      m.opponentTeamId ?? byName.get(m.opponent.trim().toLowerCase()) ?? null;
    return { ...m, teamId, id: newId(), opponentTeamId: oppId };
  });
  await db.insert(matches).values(rows);
  const ids = rows.map((r) => r.id);
  return db
    .select()
    .from(matches)
    .where(and(eq(matches.teamId, teamId), inArray(matches.id, ids)))
    .orderBy(desc(matches.date));
}

export async function updateMatch(
  teamId: string,
  id: string,
  data: Partial<InsertMatch>,
) {
  await db
    .update(matches)
    .set(data)
    .where(and(eq(matches.teamId, teamId), eq(matches.id, id)));
  return getMatch(teamId, id);
}

export async function deleteMatch(teamId: string, id: string) {
  await db
    .delete(matches)
    .where(and(eq(matches.teamId, teamId), eq(matches.id, id)));
}

// ── Actions (Live Scout) ─────────────────────────────────────────────────
export async function listActions(matchId: string) {
  return db
    .select()
    .from(actions)
    .where(eq(actions.matchId, matchId))
    .orderBy(actions.timestamp);
}

export async function createAction(data: InsertAction) {
  const id = newId();
  await db.insert(actions).values({ ...data, id });
  const [row] = await db.select().from(actions).where(eq(actions.id, id));
  if (row) void mirrorAction(row);
  return row;
}

export async function deleteAction(id: string) {
  const [row] = await db.select().from(actions).where(eq(actions.id, id));
  await db.delete(actions).where(eq(actions.id, id));
  if (row) void mirrorDeleteAction(row.matchId, id);
}

/**
 * Insere muitas acções de uma vez (usado pelo import de DataVolley). Não
 * faz mirror para Firestore — assume-se que o jogo importado é histórico
 * e não precisa de ser visto em tempo real no Second Screen.
 */
export async function bulkCreateActions(payload: InsertAction[]) {
  if (payload.length === 0) return [];
  // Postgres tem limite prático de ~32k parâmetros por query. Ataques de
  // ~1000 linhas com ~14 colunas ainda ficam confortavelmente abaixo, mas
  // partimos em chunks de 500 para não rebentar com partidas muito longas.
  const chunkSize = 500;
  const created: typeof payload = [];
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload
      .slice(i, i + chunkSize)
      .map((a) => ({ ...a, id: newId() }));
    await db.insert(actions).values(chunk);
    created.push(...chunk);
  }
  return created.length;
}

// ── Checklist ────────────────────────────────────────────────────────────
const CHECKLIST_DEFAULTS: Array<{
  category: (typeof checklistItems.$inferInsert)["category"];
  label: string;
}> = [
  { category: "lineup", label: "Definir 6 titulares e rotação inicial" },
  { category: "lineup", label: "Confirmar líbero e opções de substituição" },
  { category: "lineup", label: "Verificar estado físico (lesões, fadiga)" },
  { category: "scouting", label: "Rever último jogo do adversário" },
  { category: "scouting", label: "Identificar padrões de serviço e ataque" },
  { category: "scouting", label: "Partilhar relatório com as atletas" },
  { category: "tactical", label: "Plano de serviço (zonas-alvo)" },
  { category: "tactical", label: "Esquemas de bloco vs. setter adversário" },
  { category: "tactical", label: "Gatilhos para time-outs tácticos" },
  { category: "logistics", label: "Equipamento e material reservados" },
  { category: "logistics", label: "Transporte e hora de chegada confirmada" },
];

export async function listChecklist(matchId: string) {
  const rows = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.matchId, matchId))
    .orderBy(checklistItems.order);
  if (rows.length) return rows;
  // Seed on first read — mantém a UI simples sem um passo de "criar checklist"
  // explícito e garante que cada jogo arranca com os mesmos 11 items.
  const seeded = CHECKLIST_DEFAULTS.map((d, i) => ({
    id: newId(),
    matchId,
    category: d.category,
    label: d.label,
    done: false,
    order: i,
  }));
  await db.insert(checklistItems).values(seeded);
  return db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.matchId, matchId))
    .orderBy(checklistItems.order);
}

export async function toggleChecklistItem(id: string, done: boolean) {
  await db.update(checklistItems).set({ done }).where(eq(checklistItems.id, id));
  const [row] = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.id, id));
  if (row) void mirrorChecklistItem(row);
}

// ── Training logs (IA) ───────────────────────────────────────────────────
export async function listTrainingLogs(playerId: string) {
  const rows = await db
    .select()
    .from(trainingLogs)
    .where(eq(trainingLogs.playerId, playerId))
    .orderBy(desc(trainingLogs.createdAt));
  return rows.map((r) => ({
    ...r,
    rec: JSON.parse(r.recJson) as TrainingRecommendation,
  }));
}

export async function createTrainingLog(
  playerId: string,
  rec: TrainingRecommendation,
  priority: TrainingPriority,
) {
  const id = newId();
  await db.insert(trainingLogs).values({
    id,
    playerId,
    recJson: JSON.stringify(rec),
    priority,
    status: "pending",
  });
  return { id, rec };
}

// ── Opponent teams ──────────────────────────────────────────────────────
export async function listOpponentTeams(teamId: string) {
  return db
    .select()
    .from(opponentTeams)
    .where(eq(opponentTeams.teamId, teamId))
    .orderBy(opponentTeams.name);
}

export async function getOpponentTeam(teamId: string, id: string) {
  const [row] = await db
    .select()
    .from(opponentTeams)
    .where(
      and(eq(opponentTeams.teamId, teamId), eq(opponentTeams.id, id)),
    );
  return row;
}

export async function createOpponentTeam(data: InsertOpponentTeam) {
  const id = newId();
  await db.insert(opponentTeams).values({ ...data, id });
  const [row] = await db
    .select()
    .from(opponentTeams)
    .where(eq(opponentTeams.id, id));
  return row;
}

export async function updateOpponentTeam(
  teamId: string,
  id: string,
  data: Partial<InsertOpponentTeam>,
) {
  await db
    .update(opponentTeams)
    .set(data)
    .where(
      and(eq(opponentTeams.teamId, teamId), eq(opponentTeams.id, id)),
    );
  return getOpponentTeam(teamId, id);
}

export async function deleteOpponentTeam(teamId: string, id: string) {
  await db
    .delete(opponentTeams)
    .where(
      and(eq(opponentTeams.teamId, teamId), eq(opponentTeams.id, id)),
    );
}

/**
 * Faz match case-insensitive entre `opponent` (texto livre nos matches)
 * e o nome de uma equipa adversária catalogada. Usado pelo bulk import de
 * jogos para auto-associar o `opponentTeamId`.
 */
export async function findOpponentTeamByName(teamId: string, name: string) {
  const all = await listOpponentTeams(teamId);
  const norm = name.trim().toLowerCase();
  return all.find((o) => o.name.trim().toLowerCase() === norm) ?? null;
}

// ── Opponent players ────────────────────────────────────────────────────
export async function listOpponentPlayers(opponentTeamId: string) {
  return db
    .select()
    .from(opponentPlayers)
    .where(eq(opponentPlayers.opponentTeamId, opponentTeamId))
    .orderBy(opponentPlayers.number, opponentPlayers.lastName);
}

export async function createOpponentPlayer(data: InsertOpponentPlayer) {
  const id = newId();
  await db.insert(opponentPlayers).values({ ...data, id });
  const [row] = await db
    .select()
    .from(opponentPlayers)
    .where(eq(opponentPlayers.id, id));
  return row;
}

export async function bulkCreateOpponentPlayers(
  opponentTeamId: string,
  payload: Array<Omit<InsertOpponentPlayer, "opponentTeamId">>,
) {
  if (payload.length === 0) return [];
  const rows = payload.map((p) => ({ ...p, opponentTeamId, id: newId() }));
  await db.insert(opponentPlayers).values(rows);
  const ids = rows.map((r) => r.id);
  return db
    .select()
    .from(opponentPlayers)
    .where(
      and(
        eq(opponentPlayers.opponentTeamId, opponentTeamId),
        inArray(opponentPlayers.id, ids),
      ),
    );
}

export async function updateOpponentPlayer(
  opponentTeamId: string,
  id: string,
  data: Partial<InsertOpponentPlayer>,
) {
  await db
    .update(opponentPlayers)
    .set(data)
    .where(
      and(
        eq(opponentPlayers.opponentTeamId, opponentTeamId),
        eq(opponentPlayers.id, id),
      ),
    );
  const [row] = await db
    .select()
    .from(opponentPlayers)
    .where(eq(opponentPlayers.id, id));
  return row;
}

export async function deleteOpponentPlayer(
  opponentTeamId: string,
  id: string,
) {
  await db
    .delete(opponentPlayers)
    .where(
      and(
        eq(opponentPlayers.opponentTeamId, opponentTeamId),
        eq(opponentPlayers.id, id),
      ),
    );
}

// ── Opponent coaches ────────────────────────────────────────────────────
export async function listOpponentCoaches(opponentTeamId: string) {
  return db
    .select()
    .from(opponentCoaches)
    .where(eq(opponentCoaches.opponentTeamId, opponentTeamId))
    .orderBy(opponentCoaches.name);
}

export async function createOpponentCoach(data: InsertOpponentCoach) {
  const id = newId();
  await db.insert(opponentCoaches).values({ ...data, id });
  const [row] = await db
    .select()
    .from(opponentCoaches)
    .where(eq(opponentCoaches.id, id));
  return row;
}

export async function updateOpponentCoach(
  opponentTeamId: string,
  id: string,
  data: Partial<InsertOpponentCoach>,
) {
  await db
    .update(opponentCoaches)
    .set(data)
    .where(
      and(
        eq(opponentCoaches.opponentTeamId, opponentTeamId),
        eq(opponentCoaches.id, id),
      ),
    );
  const [row] = await db
    .select()
    .from(opponentCoaches)
    .where(eq(opponentCoaches.id, id));
  return row;
}

export async function deleteOpponentCoach(
  opponentTeamId: string,
  id: string,
) {
  await db
    .delete(opponentCoaches)
    .where(
      and(
        eq(opponentCoaches.opponentTeamId, opponentTeamId),
        eq(opponentCoaches.id, id),
      ),
    );
}

// ── History: matches vs. a specific opponent team ───────────────────────
export async function listMatchesVsOpponent(
  teamId: string,
  opponentTeamId: string,
) {
  return db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.teamId, teamId),
        eq(matches.opponentTeamId, opponentTeamId),
      ),
    )
    .orderBy(desc(matches.date));
}
