import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth";
import * as storage from "./storage";
import {
  insertTeamSchema,
  insertPlayerSchema,
  insertMatchSchema,
  insertActionSchema,
  insertOpponentTeamSchema,
  insertOpponentPlayerSchema,
  insertOpponentCoachSchema,
  insertLineupSchema,
  insertSubstitutionSchema,
} from "@shared/schema";
import { detectPatterns } from "./ai/patterns";
import { recommendTraining } from "./ai/training";
import { mirrorStatus } from "./firestore";
import {
  buildDashboard,
  buildPlayerSummary,
  buildPostMatch,
  buildScoutingReport,
  buildTeamPlayerAggregates,
} from "./stats";
import type { PatternDetectionInput } from "@shared/types";
import { PLAN_FEATURES, planMeetsMinimum } from "@shared/planFeatures";
import type { Plan } from "@shared/types";

export const router = Router();

const SUPPORTED_LANGUAGES = ["pt-PT", "en", "es", "fr"] as const;

// Todas as rotas exigem auth (dev bypass em desenvolvimento).
router.use(requireAuth);

router.get("/config", (_req, res) => {
  res.json({ mirror: mirrorStatus() });
});

// ── Teams ──────────────────────────────────────────────────────────────────────────
router.get("/teams", async (req, res) => {
  const list = await storage.listTeamsForUser(req.user!.uid);
  res.json(list);
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
  // Verificar limite de equipas para o plano do utilizador.
  // Usamos o plano da primeira equipa que o utilizador possui como referência.
  const existingTeams = await storage.listTeamsForUser(req.user!.uid);
  const ownerTeam = existingTeams.find(t => t.ownerUid === req.user!.uid);
  const currentPlan = (ownerTeam?.plan ?? "individual") as Plan;
  const maxTeams = PLAN_FEATURES[currentPlan].maxTeams;
  const ownedCount = await storage.countTeamsOwnedByUser(req.user!.uid);
  if (maxTeams !== -1 && ownedCount >= maxTeams) {
    res.status(403).json({ error: "plan_limit_teams", currentPlan, maxTeams });
    return;
  }
  const team = await storage.createTeam(req.user!.uid, parsed.data);
  res.status(201).json(team);
});

const updatePlanSchema = z.object({ plan: z.enum(["individual", "basic", "pro", "club"]) });
router.patch("/teams/:id/plan", async (req, res) => {
  const parsed = updatePlanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const ok = await storage.userBelongsToTeam(req.user!.uid, req.params.id);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  const team = await storage.updateTeamPlan(req.params.id, parsed.data.plan);
  if (!team) return res.status(404).json({ error: "not found" });
  res.json(team);
});

// Pré-visualiza a equipa associada a um código de convite (sem aderir).
router.get("/teams/join/:code", async (req, res) => {
  const team = await storage.getTeamByInviteCode(req.params.code);
  if (!team) return res.status(404).json({ error: "invalid_code" });
  res.json({ id: team.id, name: team.name, club: team.club, category: team.category });
});

// Adere à equipa com o código de convite.
router.post("/teams/join", async (req, res) => {
  const code = z.string().min(1).safeParse(req.body.code);
  if (!code.success) return res.status(400).json({ error: "code required" });
  const result = await storage.joinTeamByCode(req.user!.uid, code.data);
  if ("error" in result) {
    const status = result.error === "invalid_code" ? 404 : 409;
    return res.status(status).json({ error: result.error });
  }
  res.status(201).json(result.team);
});

// Regenera o código de convite (só o owner).
router.post("/teams/:id/regenerate-invite", async (req, res) => {
  const role = await storage.getMemberRole(req.user!.uid, req.params.id);
  if (!role) return res.status(403).json({ error: "forbidden" });
  if (role !== "owner") return res.status(403).json({ error: "owner_only" });
  const code = await storage.regenerateInviteCode(req.params.id);
  res.json({ inviteCode: code });
});

// Lista membros da equipa.
router.get("/teams/:id/members", async (req, res) => {
  const ok = await storage.userBelongsToTeam(req.user!.uid, req.params.id);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  const members = await storage.getTeamMembers(req.params.id);
  res.json(members);
});

// ── Trial / subscription helpers ─────────────────────────────────────────────

export function isTeamAccessible(team: { trialEndsAt: Date | null; subscribedAt: Date | null }): boolean {
  if (team.subscribedAt) return true;
  if (team.trialEndsAt && team.trialEndsAt > new Date()) return true;
  return false;
}

/** Middleware que bloqueia acesso se o trial expirou e não há subscrição activa. */
async function requireActiveSubscription(req: any, res: any, next: any) {
  const teamId = req.teamId as string | undefined;
  if (!teamId) return next(); // sem teamId, deixar outros middlewares tratar
  const team = await storage.getTeamById(teamId);
  if (!team) return next();
  if (!isTeamAccessible(team)) {
    return res.status(402).json({
      error: "trial_expired",
      trialEndsAt: team.trialEndsAt,
    });
  }
  next();
}

// Middleware para garantir que o utilizador pertence à equipa pedida.
// Popula req.teamId e req.teamPlan. Verifica trial/subscrição activa.
async function requireTeamAccess(req: any, res: any, next: any) {
  const teamId = (req.query.teamId ?? req.params.teamId) as string | undefined;
  if (!teamId) return res.status(400).json({ error: "teamId required" });
  const ok = await storage.userBelongsToTeam(req.user.uid, teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  req.teamId = teamId;
  const team = await storage.getTeamById(teamId);
  req.teamPlan = (team?.plan ?? "individual") as Plan;
  if (team && !isTeamAccessible(team)) {
    return res.status(402).json({ error: "trial_expired", trialEndsAt: team.trialEndsAt });
  }
  next();
}

// Middleware factory — garante que a equipa tem pelo menos o plano indicado.
function requirePlan(minimum: Plan) {
  return async (req: any, res: any, next: any) => {
    const plan: Plan = req.teamPlan ?? "individual";
    if (!planMeetsMinimum(plan, minimum)) {
      return res.status(403).json({
        error: "plan_required",
        requiredPlan: minimum,
        currentPlan: plan,
      });
    }
    next();
  };
}

// Middleware: verifica que o matchId pertence a uma equipa do utilizador.
// Popula req.match, req.teamId e req.teamPlan.
async function requireMatchAccess(req: any, res: any, next: any) {
  const matchId = req.params.matchId as string | undefined;
  if (!matchId) return res.status(400).json({ error: "matchId required" });
  const match = await storage.getMatchById(matchId);
  if (!match) return res.status(404).json({ error: "match not found" });
  const ok = await storage.userBelongsToTeam(req.user.uid, match.teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  req.match = match;
  req.teamId = match.teamId;
  if (!req.teamPlan) {
    const team = await storage.getTeamById(match.teamId);
    req.teamPlan = (team?.plan ?? "individual") as Plan;
  }
  next();
}

// Middleware: verifica que uma acção individual pertence ao utilizador.
async function requireActionAccess(req: any, res: any, next: any) {
  const action = await storage.getActionById(req.params.id);
  if (!action) return res.status(404).json({ error: "action not found" });
  const match = await storage.getMatchById(action.matchId);
  if (!match) return res.status(404).json({ error: "match not found" });
  const ok = await storage.userBelongsToTeam(req.user.uid, match.teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  next();
}

// Middleware: verifica que um item de checklist pertence ao utilizador.
async function requireChecklistAccess(req: any, res: any, next: any) {
  const item = await storage.getChecklistItemById(req.params.id);
  if (!item) return res.status(404).json({ error: "checklist item not found" });
  const match = await storage.getMatchById(item.matchId);
  if (!match) return res.status(404).json({ error: "match not found" });
  const ok = await storage.userBelongsToTeam(req.user.uid, match.teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  next();
}

// Middleware: verifica que uma substituição pertence ao utilizador.
async function requireSubstitutionAccess(req: any, res: any, next: any) {
  const sub = await storage.getSubstitutionById(req.params.id);
  if (!sub) return res.status(404).json({ error: "substitution not found" });
  const match = await storage.getMatchById(sub.matchId);
  if (!match) return res.status(404).json({ error: "match not found" });
  const ok = await storage.userBelongsToTeam(req.user.uid, match.teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  next();
}

// ── Players ──────────────────────────────────────────────────────────────────────────
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

const bulkPlayersSchema = z.object({
  teamId: z.string().min(1),
  players: z.array(insertPlayerSchema.omit({ teamId: true })).min(1).max(200),
});

router.post("/players/bulk", async (req, res) => {
  const parsed = bulkPlayersSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const ok = await storage.userBelongsToTeam(req.user!.uid, parsed.data.teamId);
  if (!ok) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const created = await storage.bulkCreatePlayers(
    parsed.data.teamId,
    parsed.data.players,
  );
  res.status(201).json({ inserted: created.length, players: created });
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

// ── Matches ──────────────────────────────────────────────────────────────────────────
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
  // Verificar limite de jogos por plano.
  const team = await storage.getTeamById(parsed.data.teamId);
  const plan = (team?.plan ?? "individual") as Plan;
  const maxMatches = PLAN_FEATURES[plan].maxMatchesPerTeam;
  if (maxMatches !== -1) {
    const matchCount = await storage.countMatchesForTeam(parsed.data.teamId);
    if (matchCount >= maxMatches) {
      res.status(403).json({ error: "plan_limit_matches", currentPlan: plan, maxMatches });
      return;
    }
  }
  const match = await storage.createMatch(parsed.data);
  res.status(201).json(match);
});

const bulkMatchesSchema = z.object({
  teamId: z.string().min(1),
  matches: z
    .array(insertMatchSchema.omit({ teamId: true }))
    .min(1)
    .max(500),
});

router.post("/matches/bulk", async (req, res) => {
  const parsed = bulkMatchesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const ok = await storage.userBelongsToTeam(req.user!.uid, parsed.data.teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  const created = await storage.bulkCreateMatches(
    parsed.data.teamId,
    parsed.data.matches,
  );
  res.status(201).json({ inserted: created.length, matches: created });
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

// ── Actions (Live Scout) ────────────────────────────────────────────────────────────
router.get("/matches/:matchId/actions", requireMatchAccess, async (req, res) => {
  res.json(await storage.listActions(req.params.matchId));
});

router.post("/actions", async (req: any, res) => {
  const parsed = insertActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  // Verifica acesso ao jogo sem confiar em teamId vindo do cliente.
  const match = await storage.getMatchById(parsed.data.matchId);
  if (!match) return res.status(404).json({ error: "match not found" });
  const ok = await storage.userBelongsToTeam(req.user!.uid, match.teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  const action = await storage.createAction(parsed.data);
  res.status(201).json(action);
});

router.delete("/actions/:id", requireActionAccess, async (req, res) => {
  await storage.deleteAction(req.params.id);
  res.status(204).end();
});

// Bulk insert (usado pelo import de DataVolley). Limita a 5000 linhas para
// evitar payloads patológicos.
const bulkActionsSchema = z.object({
  matchId: z.string().min(1),
  teamId: z.string().min(1),
  actions: z.array(insertActionSchema).min(1).max(5000),
});

router.post("/actions/bulk", async (req, res) => {
  const parsed = bulkActionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const ok = await storage.userBelongsToTeam(req.user!.uid, parsed.data.teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  // Garantia extra: todas as acções têm de pertencer ao matchId fornecido.
  const wrong = parsed.data.actions.filter((a) => a.matchId !== parsed.data.matchId);
  if (wrong.length) {
    res.status(400).json({ error: "matchId mismatch", count: wrong.length });
    return;
  }
  const inserted = await storage.bulkCreateActions(parsed.data.actions);
  res.status(201).json({ inserted });
});

// ── Checklist ──────────────────────────────────────────────────────────────────────────
router.get("/matches/:matchId/checklist", requireMatchAccess, async (req, res) => {
  res.json(await storage.listChecklist(req.params.matchId));
});

const toggleSchema = z.object({ done: z.boolean() });
router.patch("/checklist/:id", requireChecklistAccess, async (req, res) => {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  await storage.toggleChecklistItem(req.params.id, parsed.data.done);
  res.status(204).end();
});

// ── AI Pattern Detection ───────────────────────────────────────────────────────────────────
const patternsInputSchema = z.object({
  teamId: z.string(),
  opponent: z.string(),
  sampleSize: z.number(),
  serveTargets: z.record(z.string(), z.number()),
  attackByRotation: z.record(z.string(), z.record(z.string(), z.number())),
  rotationSideOut: z.record(z.string(), z.number()),
  setterDistribution: z.record(z.string(), z.number()),
});

// ── Dashboard stats ──────────────────────────────────────────────────────────────────────────
router.get(
  "/stats/team/:teamId/dashboard",
  requireTeamAccess,
  async (req: any, res) => {
    const stats = await buildDashboard(req.teamId);
    res.json(stats);
  },
);

router.get(
  "/stats/team/:teamId/player-aggregates",
  requireTeamAccess,
  async (req: any, res) => {
    const data = await buildTeamPlayerAggregates(req.teamId);
    res.json(data);
  },
);

router.post("/ai/patterns", async (req, res) => {
  const parsed = patternsInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const ok = await storage.userBelongsToTeam(req.user!.uid, parsed.data.teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  // AI patterns — requer plano Pro ou superior
  const team = await storage.getTeamById(parsed.data.teamId);
  const plan = (team?.plan ?? "individual") as Plan;
  if (!planMeetsMinimum(plan, "pro")) {
    return res.status(403).json({ error: "plan_required", requiredPlan: "pro", currentPlan: plan });
  }
  try {
    const patterns = await detectPatterns(parsed.data as PatternDetectionInput);
    res.json({ patterns });
  } catch (err) {
    console.error("AI patterns error", err);
    res.status(500).json({ error: "ai_failed" });
  }
});

// ── Scouting report (opponent) ───────────────────────────────────────────────────────────────
router.get(
  "/scouting/:opponent",
  requireTeamAccess,
  async (req: any, res) => {
    const opp = decodeURIComponent(req.params.opponent);
    const report = await buildScoutingReport(req.teamId, opp);
    if (!report) return res.status(404).json({ error: "no_data" });
    res.json(report);
  },
);

// ── Post-match summary ──────────────────────────────────────────────────────────────────────────
router.get(
  "/matches/:matchId/summary",
  requireTeamAccess,
  async (req: any, res) => {
    const summary = await buildPostMatch(req.teamId, req.params.matchId);
    if (!summary) return res.status(404).json({ error: "not found" });
    res.json(summary);
  },
);

// ── Player summary + training recommendations ───────────────────────────────────────────────────
router.get(
  "/players/:id/summary",
  requireTeamAccess,
  async (req: any, res) => {
    const summary = await buildPlayerSummary(req.teamId, req.params.id);
    if (!summary) return res.status(404).json({ error: "not found" });
    res.json(summary);
  },
);

router.get(
  "/training/:playerId",
  requireTeamAccess,
  async (req: any, res) => {
    const player = await storage.getPlayer(req.teamId, req.params.playerId);
    if (!player) return res.status(404).json({ error: "not found" });
    res.json(await storage.listTrainingLogs(req.params.playerId));
  },
);

router.post(
  "/ai/training/:playerId",
  requireTeamAccess,
  requirePlan("club"),
  async (req: any, res) => {
    const summary = await buildPlayerSummary(req.teamId, req.params.playerId);
    if (!summary) return res.status(404).json({ error: "not found" });
    try {
      const recs = await recommendTraining({
        playerId: summary.player.id,
        firstName: summary.player.firstName,
        lastName: summary.player.lastName,
        position: summary.player.position,
        sampleActions: summary.actions,
        kpis: summary.kpis,
        weaknesses: summary.weaknesses,
      });
      const saved = [];
      for (const r of recs) {
        saved.push(
          await storage.createTrainingLog(summary.player.id, r, r.priority),
        );
      }
      res.json({ recommendations: recs, saved });
    } catch (err) {
      console.error("AI training error", err);
      res.status(500).json({ error: "ai_failed" });
    }
  },
);

// ── Opponent teams — requer plano Pro ou superior ──────────────────────────────────────────
router.get("/opponents", requireTeamAccess, requirePlan("pro"), async (req: any, res) => {
  res.json(await storage.listOpponentTeams(req.teamId));
});

router.post("/opponents", async (req, res) => {
  const parsed = insertOpponentTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const ok = await storage.userBelongsToTeam(req.user!.uid, parsed.data.teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  const team = await storage.getTeamById(parsed.data.teamId);
  const plan = (team?.plan ?? "individual") as Plan;
  if (!planMeetsMinimum(plan, "pro")) {
    return res.status(403).json({ error: "plan_required", requiredPlan: "pro", currentPlan: plan });
  }
  const row = await storage.createOpponentTeam(parsed.data);
  res.status(201).json(row);
});

// Middleware que valida acesso a uma opponent team específica via :id.
async function requireOpponentAccess(req: any, res: any, next: any) {
  const teamId = (req.query.teamId ?? req.params.teamId) as string | undefined;
  if (!teamId) return res.status(400).json({ error: "teamId required" });
  const ok = await storage.userBelongsToTeam(req.user.uid, teamId);
  if (!ok) return res.status(403).json({ error: "forbidden" });
  const opp = await storage.getOpponentTeam(teamId, req.params.id);
  if (!opp) return res.status(404).json({ error: "not found" });
  req.teamId = teamId;
  req.opponent = opp;
  next();
}

router.get("/opponents/:id", requireOpponentAccess, async (req: any, res) => {
  res.json(req.opponent);
});

const updateOpponentTeamSchema = insertOpponentTeamSchema.partial();

router.patch(
  "/opponents/:id",
  requireOpponentAccess,
  async (req: any, res) => {
    const parsed = updateOpponentTeamSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const row = await storage.updateOpponentTeam(
      req.teamId,
      req.params.id,
      parsed.data,
    );
    res.json(row);
  },
);

router.delete(
  "/opponents/:id",
  requireOpponentAccess,
  async (req: any, res) => {
    await storage.deleteOpponentTeam(req.teamId, req.params.id);
    res.status(204).end();
  },
);

// ── Opponent players (roster) ───────────────────────────────────────────────────────────────────
router.get(
  "/opponents/:id/players",
  requireOpponentAccess,
  async (req: any, res) => {
    res.json(await storage.listOpponentPlayers(req.params.id));
  },
);

router.post(
  "/opponents/:id/players",
  requireOpponentAccess,
  async (req: any, res) => {
    const parsed = insertOpponentPlayerSchema.safeParse({
      ...req.body,
      opponentTeamId: req.params.id,
    });
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const row = await storage.createOpponentPlayer(parsed.data);
    res.status(201).json(row);
  },
);

const bulkOpponentPlayersSchema = z.object({
  players: z
    .array(insertOpponentPlayerSchema.omit({ opponentTeamId: true }))
    .min(1)
    .max(200),
});

router.post(
  "/opponents/:id/players/bulk",
  requireOpponentAccess,
  async (req: any, res) => {
    const parsed = bulkOpponentPlayersSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const rows = await storage.bulkCreateOpponentPlayers(
      req.params.id,
      parsed.data.players,
    );
    res.status(201).json({ inserted: rows.length, players: rows });
  },
);

router.patch(
  "/opponents/:id/players/:playerId",
  requireOpponentAccess,
  async (req: any, res) => {
    const parsed = insertOpponentPlayerSchema
      .partial()
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const row = await storage.updateOpponentPlayer(
      req.params.id,
      req.params.playerId,
      parsed.data,
    );
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  },
);

router.delete(
  "/opponents/:id/players/:playerId",
  requireOpponentAccess,
  async (req: any, res) => {
    await storage.deleteOpponentPlayer(req.params.id, req.params.playerId);
    res.status(204).end();
  },
);

// ── Opponent coaches ──────────────────────────────────────────────────────────────────────────
router.get(
  "/opponents/:id/coaches",
  requireOpponentAccess,
  async (req: any, res) => {
    res.json(await storage.listOpponentCoaches(req.params.id));
  },
);

router.post(
  "/opponents/:id/coaches",
  requireOpponentAccess,
  async (req: any, res) => {
    const parsed = insertOpponentCoachSchema.safeParse({
      ...req.body,
      opponentTeamId: req.params.id,
    });
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const row = await storage.createOpponentCoach(parsed.data);
    res.status(201).json(row);
  },
);

router.patch(
  "/opponents/:id/coaches/:coachId",
  requireOpponentAccess,
  async (req: any, res) => {
    const parsed = insertOpponentCoachSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());
    const row = await storage.updateOpponentCoach(
      req.params.id,
      req.params.coachId,
      parsed.data,
    );
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  },
);

router.delete(
  "/opponents/:id/coaches/:coachId",
  requireOpponentAccess,
  async (req: any, res) => {
    await storage.deleteOpponentCoach(req.params.id, req.params.coachId);
    res.status(204).end();
  },
);

// ── Opponent history (matches vs this opponent) ──────────────────────────────────────────────────────
router.get(
  "/opponents/:id/matches",
  requireOpponentAccess,
  async (req: any, res) => {
    res.json(await storage.listMatchesVsOpponent(req.teamId, req.params.id));
  },
);

// ── Lineups ──────────────────────────────────────────────────────────────────────────
router.get("/matches/:matchId/lineups", requireMatchAccess, async (req, res) => {
  res.json(await storage.listLineupsForMatch(req.params.matchId));
});

router.post("/matches/:matchId/lineups", requireMatchAccess, async (req, res) => {
  const parsed = insertLineupSchema.safeParse({
    ...req.body,
    matchId: req.params.matchId,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const row = await storage.saveLineup(parsed.data);
  res.status(201).json(row);
});

// ── Substitutions ──────────────────────────────────────────────────────────────────────────
router.get("/matches/:matchId/substitutions", requireMatchAccess, async (req, res) => {
  res.json(await storage.listSubstitutionsForMatch(req.params.matchId));
});

router.post("/matches/:matchId/substitutions", requireMatchAccess, async (req, res) => {
  const parsed = insertSubstitutionSchema.safeParse({
    ...req.body,
    matchId: req.params.matchId,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const row = await storage.createSubstitution(parsed.data);
  res.status(201).json(row);
});

router.delete("/substitutions/:id", requireSubstitutionAccess, async (req, res) => {
  await storage.deleteSubstitution(req.params.id);
  res.status(204).end();
});

// ── User Preferences ──────────────────────────────────────────────────────────
router.get("/user/preferences", async (req, res) => {
  const uid = req.user!.uid;
  const prefs = await storage.getUserPreferences(uid);
  res.json({ language: prefs?.language ?? "pt-PT" });
});

router.patch("/user/preferences", async (req, res) => {
  const uid = req.user!.uid;
  const langSchema = z.object({ language: z.enum(SUPPORTED_LANGUAGES) });
  const parsed = langSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const prefs = await storage.upsertUserPreferences(uid, parsed.data.language);
  res.json({ language: prefs?.language ?? parsed.data.language });
});
