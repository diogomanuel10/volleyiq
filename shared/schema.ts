import { type InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  ACTION_RESULTS,
  ACTION_TYPES,
  CHECKLIST_CATEGORIES,
  PLANS,
  POSITIONS,
  TRAINING_PRIORITIES,
} from "./types";

/**
 * Todas as tabelas carregam `teamId` quando aplicável. Esse campo é a
 * fronteira de tenancy — o middleware `tenantGuard` do server garante que
 * nenhum endpoint devolve linhas de outra equipa.
 */

// ── Users ↔ Teams (membership) ────────────────────────────────────────────
export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  club: text("club").notNull(),
  // Escalão em texto livre (ex: "Seniores Femininas", "Sub-18 M", etc.).
  category: text("category").notNull(),
  season: text("season"),
  division: text("division"),
  // Hex string incluindo `#` (ex: `#0ea5e9`).
  primaryColor: text("primary_color"),
  plan: text("plan", { enum: PLANS }).notNull().default("basic"),
  ownerUid: text("owner_uid").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    uid: text("uid").notNull(),
    role: text("role", { enum: ["owner", "coach", "analyst", "viewer"] })
      .notNull()
      .default("coach"),
  },
  (t) => ({
    byTeam: index("memberships_team_idx").on(t.teamId),
    byUid: index("memberships_uid_idx").on(t.uid),
  }),
);

// ── Players ──────────────────────────────────────────────────────────────
export const players = pgTable(
  "players",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    number: integer("number").notNull(),
    position: text("position", { enum: POSITIONS }).notNull(),
    heightCm: integer("height_cm"),
    dominantHand: text("dominant_hand", { enum: ["left", "right"] }),
    birthDate: text("birth_date"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({ byTeam: index("players_team_idx").on(t.teamId) }),
);

// ── Matches ──────────────────────────────────────────────────────────────
export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    opponent: text("opponent").notNull(),
    date: timestamp("date").notNull(),
    venue: text("venue", { enum: ["home", "away", "neutral"] })
      .notNull()
      .default("home"),
    competition: text("competition"),
    setsWon: integer("sets_won").notNull().default(0),
    setsLost: integer("sets_lost").notNull().default(0),
    status: text("status", {
      enum: ["scheduled", "live", "finished", "cancelled"],
    })
      .notNull()
      .default("scheduled"),
    notes: text("notes"),
    videoUrl: text("video_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({ byTeam: index("matches_team_idx").on(t.teamId) }),
);

export const sets = pgTable(
  "sets",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    homeScore: integer("home_score").notNull().default(0),
    awayScore: integer("away_score").notNull().default(0),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
  },
  (t) => ({ byMatch: index("sets_match_idx").on(t.matchId) }),
);

// ── Lineups (p1..p6 por rotação inicial de cada set) ─────────────────────
export const lineups = pgTable(
  "lineups",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    rotation: integer("rotation").notNull().default(1), // 1..6
    p1: text("p1").references(() => players.id),
    p2: text("p2").references(() => players.id),
    p3: text("p3").references(() => players.id),
    p4: text("p4").references(() => players.id),
    p5: text("p5").references(() => players.id),
    p6: text("p6").references(() => players.id),
  },
  (t) => ({ byMatch: index("lineups_match_idx").on(t.matchId) }),
);

// ── Actions (grão fino — ~500 linhas / jogo) ─────────────────────────────
export const actions = pgTable(
  "actions",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    setId: text("set_id").references(() => sets.id, { onDelete: "cascade" }),
    playerId: text("player_id").references(() => players.id),
    type: text("type", { enum: ACTION_TYPES }).notNull(),
    result: text("result", { enum: ACTION_RESULTS }).notNull(),
    zoneFrom: integer("zone_from"),
    zoneTo: integer("zone_to"),
    rallyId: text("rally_id"),
    rotation: integer("rotation"),
    // Contexto opcional (jogador adversário em ataque, setter visível, etc.)
    opponentPlayer: integer("opponent_player"),
    videoTimeSec: integer("video_time_sec"),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (t) => ({
    byMatch: index("actions_match_idx").on(t.matchId),
    byPlayer: index("actions_player_idx").on(t.playerId),
    byType: index("actions_type_idx").on(t.type),
  }),
);

// ── Match day checklist ──────────────────────────────────────────────────
export const checklistItems = pgTable(
  "checklist_items",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    category: text("category", { enum: CHECKLIST_CATEGORIES }).notNull(),
    label: text("label").notNull(),
    done: boolean("done").notNull().default(false),
    order: integer("order").notNull().default(0),
  },
  (t) => ({ byMatch: index("checklist_match_idx").on(t.matchId) }),
);

// ── Scouting reports (JSON de padrões gerado pela IA) ────────────────────
export const scoutingReports = pgTable(
  "scouting_reports",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    opponent: text("opponent").notNull(),
    matchIds: text("match_ids").notNull(), // JSON string[]
    patternsJson: text("patterns_json").notNull(), // DetectedPattern[]
    summaryMd: text("summary_md"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({ byTeam: index("reports_team_idx").on(t.teamId) }),
);

// ── Training logs (recomendações IA por atleta) ──────────────────────────
export const trainingLogs = pgTable(
  "training_logs",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    recJson: text("rec_json").notNull(), // { title, focus, drills[] }
    priority: text("priority", { enum: TRAINING_PRIORITIES })
      .notNull()
      .default("medium"),
    status: text("status", {
      enum: ["pending", "in_progress", "done", "skipped"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({ byPlayer: index("training_player_idx").on(t.playerId) }),
);

// ── Zod inserts + inferred select types ──────────────────────────────────
// Select types via `InferSelectModel` (Drizzle); insert schemas via drizzle-zod
// para validação de payloads que chegam dos clients.

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
});
export type Team = InferSelectModel<typeof teams>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  createdAt: true,
});
export type Player = InferSelectModel<typeof players>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;

export const insertMatchSchema = createInsertSchema(matches)
  .omit({ id: true, createdAt: true })
  .extend({ date: z.coerce.date() });
export type Match = InferSelectModel<typeof matches>;
export type InsertMatch = z.infer<typeof insertMatchSchema>;

export const insertActionSchema = createInsertSchema(actions).omit({
  id: true,
  timestamp: true,
});
export type Action = InferSelectModel<typeof actions>;
export type InsertAction = z.infer<typeof insertActionSchema>;

export const insertChecklistItemSchema = createInsertSchema(checklistItems).omit({
  id: true,
});
export type ChecklistItem = InferSelectModel<typeof checklistItems>;

export const insertLineupSchema = createInsertSchema(lineups).omit({ id: true });
export type Lineup = InferSelectModel<typeof lineups>;

export const insertSetSchema = createInsertSchema(sets).omit({ id: true });
export type GameSet = InferSelectModel<typeof sets>;

export type ScoutingReport = InferSelectModel<typeof scoutingReports>;
export type TrainingLog = InferSelectModel<typeof trainingLogs>;
