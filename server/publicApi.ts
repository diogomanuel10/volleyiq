import { Router } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "./db";
import { teams, matches, players, actions } from "@shared/schema";
import { getTeamByApiKey } from "./storage";
import { buildDashboard, buildTeamPlayerAggregates } from "./stats";

export const publicRouter = Router();

async function authenticate(req: any, res: any): Promise<string | null> {
  const auth = (req.headers.authorization ?? "") as string;
  if (!auth.startsWith("Bearer viq_")) {
    res.status(401).json({
      error: "unauthorized",
      hint: "Include Authorization: Bearer <api_key> header",
    });
    return null;
  }
  const teamId = await getTeamByApiKey(auth.slice(7));
  if (!teamId) {
    res.status(401).json({ error: "invalid_or_revoked_key" });
    return null;
  }
  return teamId;
}

// GET /api/public/v1/team
publicRouter.get("/team", async (req, res) => {
  const teamId = await authenticate(req, res);
  if (!teamId) return;
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) return res.status(404).json({ error: "not_found" });
  const { ownerUid: _, inviteCode: __, ...safe } = team;
  res.json(safe);
});

// GET /api/public/v1/matches
publicRouter.get("/matches", async (req, res) => {
  const teamId = await authenticate(req, res);
  if (!teamId) return;
  const rows = await db
    .select()
    .from(matches)
    .where(eq(matches.teamId, teamId))
    .orderBy(desc(matches.date));
  res.json(rows);
});

// GET /api/public/v1/players
publicRouter.get("/players", async (req, res) => {
  const teamId = await authenticate(req, res);
  if (!teamId) return;
  const rows = await db
    .select()
    .from(players)
    .where(eq(players.teamId, teamId));
  res.json(rows);
});

// GET /api/public/v1/stats/kpis
publicRouter.get("/stats/kpis", async (req, res) => {
  const teamId = await authenticate(req, res);
  if (!teamId) return;
  const data = await buildDashboard(teamId);
  res.json(data.kpis);
});

// GET /api/public/v1/stats/players
publicRouter.get("/stats/players", async (req, res) => {
  const teamId = await authenticate(req, res);
  if (!teamId) return;
  const data = await buildTeamPlayerAggregates(teamId);
  res.json(data);
});

// GET /api/public/v1/actions — last 5000 actions, newest first
publicRouter.get("/actions", async (req, res) => {
  const teamId = await authenticate(req, res);
  if (!teamId) return;
  const teamMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.teamId, teamId));
  if (!teamMatches.length) return res.json([]);
  const matchIds = teamMatches.map((m) => m.id);
  const rows = await db
    .select()
    .from(actions)
    .where(inArray(actions.matchId, matchIds))
    .limit(5000);
  res.json(rows);
});
