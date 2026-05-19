import { eq, and, desc, inArray, isNull, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import crypto from "crypto";
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
  lineups,
  substitutions,
  userPreferences,
  apiKeys,
  type InsertTeam,
  type InsertPlayer,
  type InsertMatch,
  type InsertAction,
  type InsertOpponentTeam,
  type InsertOpponentPlayer,
  type InsertOpponentCoach,
  type InsertLineup,
  type InsertSubstitution,
  type ApiKey,
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

// Código de convite: 6 chars maiúsculos sem ambiguidade (sem 0/O, 1/I).
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newInviteCode() {
  return Array.from({ length: 6 }, () =>
    INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)],
  ).join("");
}

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
  const inviteCode = newInviteCode();
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(teams).values({ ...data, id, ownerUid: uid, inviteCode, trialEndsAt });
  await db.insert(memberships).values({
    id: newId(),
    teamId: id,
    uid,
    role: "owner",
  });
  const [row] = await db.select().from(teams).where(eq(teams.id, id));
  return row!;
}

export async function getTeamById(teamId: string) {
  const [row] = await db.select().from(teams).where(eq(teams.id, teamId));
  return row ?? null;
}

export async function activateSubscription(
  teamId: string,
  plan: "basic" | "individual" | "pro" | "club",
  easyPaySubscriptionId?: string,
) {
  await db
    .update(teams)
    .set({
      plan,
      subscribedAt: new Date(),
      ...(easyPaySubscriptionId ? { easyPaySubscriptionId } : {}),
    })
    .where(eq(teams.id, teamId));
  const [row] = await db.select().from(teams).where(eq(teams.id, teamId));
  return row ?? null;
}

export async function cancelSubscription(teamId: string) {
  await db
    .update(teams)
    .set({ subscribedAt: null, easyPaySubscriptionId: null })
    .where(eq(teams.id, teamId));
}

export async function trackPdfExport(teamId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const PDF_LIMIT = 3;
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const team = await getTeamById(teamId);
  if (!team) return { allowed: false, used: 0, limit: PDF_LIMIT };

  // Reset counter if new month
  const count = team.pdfExportsMonth === currentMonth ? team.pdfExportsCount : 0;

  if (count >= PDF_LIMIT) {
    return { allowed: false, used: count, limit: PDF_LIMIT };
  }

  await db
    .update(teams)
    .set({ pdfExportsCount: count + 1, pdfExportsMonth: currentMonth })
    .where(eq(teams.id, teamId));

  return { allowed: true, used: count + 1, limit: PDF_LIMIT };
}

export async function getTeamByInviteCode(code: string) {
  const [row] = await db
    .select()
    .from(teams)
    .where(eq(teams.inviteCode, code.toUpperCase()));
  return row ?? null;
}

export async function joinTeamByCode(uid: string, code: string) {
  const team = await getTeamByInviteCode(code);
  if (!team) return { error: "invalid_code" as const };
  const already = await userBelongsToTeam(uid, team.id);
  if (already) return { error: "already_member" as const };
  await db.insert(memberships).values({
    id: newId(),
    teamId: team.id,
    uid,
    role: "coach",
  });
  return { team };
}

export async function regenerateInviteCode(teamId: string) {
  const code = newInviteCode();
  await db.update(teams).set({ inviteCode: code }).where(eq(teams.id, teamId));
  return code;
}

export async function getTeamMembers(teamId: string) {
  return db
    .select()
    .from(memberships)
    .where(eq(memberships.teamId, teamId));
}

export async function getMemberRole(uid: string, teamId: string) {
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.uid, uid), eq(memberships.teamId, teamId)))
    .limit(1);
  return row?.role ?? null;
}

export async function userBelongsToTeam(uid: string, teamId: string) {
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.uid, uid), eq(memberships.teamId, teamId)))
    .limit(1);
  return !!row;
}

export async function countTeamsOwnedByUser(uid: string) {
  const [row] = await db
    .select({ n: count() })
    .from(teams)
    .where(eq(teams.ownerUid, uid));
  return row?.n ?? 0;
}

export async function countMatchesForTeam(teamId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(matches)
    .where(eq(matches.teamId, teamId));
  return row?.n ?? 0;
}

export async function countPlayersForTeam(teamId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(players)
    .where(and(eq(players.teamId, teamId), eq(players.active, true)));
  return row?.n ?? 0;
}

export async function listRecentMatchesForTeam(teamId: string, limit: number) {
  return db
    .select()
    .from(matches)
    .where(eq(matches.teamId, teamId))
    .orderBy(desc(matches.date))
    .limit(limit);
}

export async function updateTeamPlan(
  teamId: string,
  plan: "individual" | "basic" | "pro" | "club",
) {
  // Activar subscrição ao mudar de plano (mock — será substituído por webhook EasyPay)
  await db
    .update(teams)
    .set({ plan, subscribedAt: new Date() })
    .where(eq(teams.id, teamId));
  const [row] = await db.select().from(teams).where(eq(teams.id, teamId));
  return row;
}

export async function updateTeam(
  teamId: string,
  data: { name?: string; club?: string; category?: string; primaryColor?: string | null },
) {
  const [row] = await db
    .update(teams)
    .set(data)
    .where(eq(teams.id, teamId))
    .returning();
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

/** Devolve um jogo pelo id sem restrição de equipa — usado pelos middlewares de acesso. */
export async function getMatchById(id: string) {
  const [row] = await db.select().from(matches).where(eq(matches.id, id));
  return row ?? null;
}

/** Devolve uma acção pelo id — usado pelo middleware de delete. */
export async function getActionById(id: string) {
  const [row] = await db.select().from(actions).where(eq(actions.id, id));
  return row ?? null;
}

/** Devolve um item de checklist pelo id — usado pelo middleware de toggle. */
export async function getChecklistItemById(id: string) {
  const [row] = await db.select().from(checklistItems).where(eq(checklistItems.id, id));
  return row ?? null;
}

/** Devolve uma substituição pelo id — usado pelo middleware de delete. */
export async function getSubstitutionById(id: string) {
  const [row] = await db.select().from(substitutions).where(eq(substitutions.id, id));
  return row ?? null;
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

// ── Lineups ─────────────────────────────────────────────────────────────
export async function listLineupsForMatch(matchId: string) {
  return db
    .select()
    .from(lineups)
    .where(eq(lineups.matchId, matchId))
    .orderBy(lineups.setNumber);
}

/**
 * Upsert por (matchId, setNumber). Cada set tem no máximo um lineup
 * inicial — guardamos os 6 jogadores e a rotação de partida.
 */
export async function saveLineup(data: InsertLineup) {
  const existing = await db
    .select()
    .from(lineups)
    .where(
      and(
        eq(lineups.matchId, data.matchId),
        eq(lineups.setNumber, data.setNumber),
      ),
    )
    .limit(1);
  if (existing.length) {
    await db
      .update(lineups)
      .set(data)
      .where(eq(lineups.id, existing[0].id));
    const [row] = await db
      .select()
      .from(lineups)
      .where(eq(lineups.id, existing[0].id));
    return row;
  }
  const id = newId();
  await db.insert(lineups).values({ ...data, id });
  const [row] = await db.select().from(lineups).where(eq(lineups.id, id));
  return row;
}

// ── Substitutions ───────────────────────────────────────────────────────
export async function listSubstitutionsForMatch(matchId: string) {
  return db
    .select()
    .from(substitutions)
    .where(eq(substitutions.matchId, matchId))
    .orderBy(substitutions.timestamp);
}

export async function createSubstitution(data: InsertSubstitution) {
  const id = newId();
  await db.insert(substitutions).values({ ...data, id });
  const [row] = await db
    .select()
    .from(substitutions)
    .where(eq(substitutions.id, id));
  return row;
}

export async function deleteSubstitution(id: string) {
  await db.delete(substitutions).where(eq(substitutions.id, id));
}

// ── User Preferences ────────────────────────────────────────────────────────
export async function getUserPreferences(uid: string) {
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.uid, uid));
  return row ?? null;
}

export async function upsertUserPreferences(uid: string, language: string) {
  await db
    .insert(userPreferences)
    .values({ uid, language })
    .onConflictDoUpdate({
      target: userPreferences.uid,
      set: { language, updatedAt: new Date() },
    });
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.uid, uid));
  return row;
}

// ── API Keys ─────────────────────────────────────────────────────────────

export async function createApiKey(
  teamId: string,
  name: string,
): Promise<{ key: string; record: ApiKey }> {
  const raw = `viq_${crypto.randomBytes(24).toString("hex")}`; // 52 chars
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const keyPrefix = raw.slice(0, 12);
  const id = nanoid();
  const [record] = await db
    .insert(apiKeys)
    .values({ id, teamId, name, keyHash, keyPrefix })
    .returning();
  return { key: raw, record };
}

export async function listApiKeys(teamId: string): Promise<ApiKey[]> {
  return db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.teamId, teamId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(id: string, teamId: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.teamId, teamId)));
}

export async function getTeamByApiKey(
  rawKey: string,
): Promise<string | null> { // returns teamId or null
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const [row] = await db
    .select({ id: apiKeys.id, teamId: apiKeys.teamId })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)));
  if (!row) return null;
  // fire-and-forget lastUsedAt update
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => {});
  return row.teamId;
}
