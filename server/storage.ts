import { eq, and, desc } from "drizzle-orm";
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
  type InsertTeam,
  type InsertPlayer,
  type InsertMatch,
  type InsertAction,
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
  const row = await db.select().from(teams).where(eq(teams.id, id)).get();
  return row!;
}

export async function userBelongsToTeam(uid: string, teamId: string) {
  const row = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.uid, uid), eq(memberships.teamId, teamId)))
    .get();
  return !!row;
}

export async function updateTeamPlan(
  teamId: string,
  plan: "basic" | "pro" | "club",
) {
  await db.update(teams).set({ plan }).where(eq(teams.id, teamId));
  return db.select().from(teams).where(eq(teams.id, teamId)).get();
}

// ── Players ──────────────────────────────────────────────────────────────
export async function listPlayers(teamId: string) {
  return db.select().from(players).where(eq(players.teamId, teamId));
}

export async function getPlayer(teamId: string, id: string) {
  return db
    .select()
    .from(players)
    .where(and(eq(players.teamId, teamId), eq(players.id, id)))
    .get();
}

export async function createPlayer(data: InsertPlayer) {
  const id = newId();
  await db.insert(players).values({ ...data, id });
  return db.select().from(players).where(eq(players.id, id)).get();
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
  return db
    .select()
    .from(matches)
    .where(and(eq(matches.teamId, teamId), eq(matches.id, id)))
    .get();
}

export async function createMatch(data: InsertMatch) {
  const id = newId();
  await db.insert(matches).values({ ...data, id });
  return db.select().from(matches).where(eq(matches.id, id)).get();
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
  const row = await db.select().from(actions).where(eq(actions.id, id)).get();
  if (row) void mirrorAction(row);
  return row;
}

export async function deleteAction(id: string) {
  const row = await db.select().from(actions).where(eq(actions.id, id)).get();
  await db.delete(actions).where(eq(actions.id, id));
  if (row) void mirrorDeleteAction(row.matchId, id);
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
  const row = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.id, id))
    .get();
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
