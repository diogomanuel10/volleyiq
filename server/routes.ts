import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth";
import * as storage from "./storage";
import {
  insertTeamSchema,
  insertPlayerSchema,
  insertMatchSchema,
  insertActionSchema,
} from "@shared/schema";
import { detectPatterns } from "./ai/patterns";
import type { PatternDetectionInput } from "@shared/types";

export const router = Router();

// Todas as rotas exigem auth (dev bypass em desenvolvimento).
router.use(requireAuth);

// ── Teams ────────────────────────────────────────────────────────────────
router.get("/teams", async (req, res) => {
  const list = await storage.listTeamsForUser(req.user!.uid);
  res.json(list);
});

/**
 * Em dev, se o utilizador não tiver equipa nenhuma, cria uma com roster seed.
 * Evita o ecrã vazio sem obrigar a construir já o wizard de onboarding.
 */
router.post("/teams/bootstrap", async (req, res) => {
  const team = await storage.ensureBootstrapTeam(req.user!.uid);
  res.json(team);
});

router.post("/teams", async (req, res) => {
  const parsed = insertTeamSchema.safeParse({
    ...req.body,
    ownerUid: req.user!.uid,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const team = await storage.createTeam(req.user!.uid, parsed.data);
  res.status(201).json(team);
});

// Middleware para garantir que o utilizador pertence à equipa pedida.
async function requireTeamAccess(req: any, res: any, next: any) {
  const teamId = (req.query.teamId ?? req.params.teamId) as string | undefined;
  if (!teamId) return res.status(400).json({ error: "teamId required" });
  const ok = await storage.userBelongsToTeam(req.user.uid, teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  req.teamId = teamId;
  next();
}

// ── Players ──────────────────────────────────────────────────────────────
router.get("/players", requireTeamAccess, async (req: any, res) => {
  res.json(await storage.listPlayers(req.teamId));
});

router.post("/players", async (req, res) => {
  const parsed = insertPlayerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const ok = await storage.userBelongsToTeam(req.user!.uid, parsed.data.teamId);
  if (!ok) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const player = await storage.createPlayer(parsed.data);
  res.status(201).json(player);
});

router.get(
  "/players/:id",
  requireTeamAccess,
  async (req: any, res) => {
    const p = await storage.getPlayer(req.teamId, req.params.id);
    if (!p) return res.status(404).json({ error: "not found" });
    res.json(p);
  },
);

const updatePlayerSchema = insertPlayerSchema.partial();

router.patch(
  "/players/:id",
  requireTeamAccess,
  async (req: any, res) => {
    const parsed = updatePlayerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const player = await storage.updatePlayer(
      req.teamId,
      req.params.id,
      parsed.data,
    );
    if (!player) return res.status(404).json({ error: "not found" });
    res.json(player);
  },
);

router.delete(
  "/players/:id",
  requireTeamAccess,
  async (req: any, res) => {
    await storage.deletePlayer(req.teamId, req.params.id);
    res.status(204).end();
  },
);

// ── Matches ──────────────────────────────────────────────────────────────
router.get("/matches", requireTeamAccess, async (req: any, res) => {
  res.json(await storage.listMatches(req.teamId));
});

router.post("/matches", async (req, res) => {
  const parsed = insertMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const ok = await storage.userBelongsToTeam(req.user!.uid, parsed.data.teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  const match = await storage.createMatch(parsed.data);
  res.status(201).json(match);
});

const updateMatchSchema = insertMatchSchema.partial();

router.patch(
  "/matches/:id",
  requireTeamAccess,
  async (req: any, res) => {
    const parsed = updateMatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const match = await storage.updateMatch(
      req.teamId,
      req.params.id,
      parsed.data,
    );
    if (!match) return res.status(404).json({ error: "not found" });
    res.json(match);
  },
);

router.delete(
  "/matches/:id",
  requireTeamAccess,
  async (req: any, res) => {
    await storage.deleteMatch(req.teamId, req.params.id);
    res.status(204).end();
  },
);

// ── Actions (Live Scout) ─────────────────────────────────────────────────
router.get("/matches/:matchId/actions", async (req, res) => {
  res.json(await storage.listActions(req.params.matchId));
});

router.post("/actions", async (req, res) => {
  const parsed = insertActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const action = await storage.createAction(parsed.data);
  res.status(201).json(action);
});

router.delete("/actions/:id", async (req, res) => {
  await storage.deleteAction(req.params.id);
  res.status(204).end();
});

// ── Checklist ────────────────────────────────────────────────────────────
router.get("/matches/:matchId/checklist", async (req, res) => {
  res.json(await storage.listChecklist(req.params.matchId));
});

const toggleSchema = z.object({ done: z.boolean() });
router.patch("/checklist/:id", async (req, res) => {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  await storage.toggleChecklistItem(req.params.id, parsed.data.done);
  res.status(204).end();
});

// ── AI Pattern Detection ─────────────────────────────────────────────────
const patternsInputSchema = z.object({
  teamId: z.string(),
  opponent: z.string(),
  sampleSize: z.number(),
  serveTargets: z.record(z.string(), z.number()),
  attackByRotation: z.record(z.string(), z.record(z.string(), z.number())),
  rotationSideOut: z.record(z.string(), z.number()),
  setterDistribution: z.record(z.string(), z.number()),
});

router.post("/ai/patterns", async (req, res) => {
  const parsed = patternsInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const ok = await storage.userBelongsToTeam(req.user!.uid, parsed.data.teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  try {
    const patterns = await detectPatterns(parsed.data as PatternDetectionInput);
    res.json({ patterns });
  } catch (err) {
    console.error("AI patterns error", err);
    res.status(500).json({ error: "ai_failed" });
  }
});
