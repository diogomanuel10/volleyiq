/**
 * Testes de integração das rotas HTTP.
 *
 * Estratégia: o módulo `./server/storage` é substituído por um mock completo
 * via vi.mock, e DEV_AUTH_BYPASS=true injeta o utilizador "dev-user" sem
 * precisar de Firebase. Assim testamos o comportamento das rotas (validação
 * de input, chamadas ao storage, respostas HTTP) sem base de dados.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// DEV_AUTH_BYPASS é definido no setup.ts antes de qualquer import.

// ── Mock do módulo storage ────────────────────────────────────────────────────

vi.mock("../storage", () => ({
  listTeamsForUser: vi.fn(),
  createTeam: vi.fn(),
  getMemberRole: vi.fn(),
  userBelongsToTeam: vi.fn(),
  getTeamById: vi.fn(),
  listPlayers: vi.fn(),
  createPlayer: vi.fn(),
  updatePlayer: vi.fn(),
  deletePlayer: vi.fn(),
  getPlayer: vi.fn(),
  bulkCreatePlayers: vi.fn(),
  listMatches: vi.fn(),
  createMatch: vi.fn(),
  getMatchById: vi.fn(),
  updateMatch: vi.fn(),
  deleteMatch: vi.fn(),
  bulkCreateMatches: vi.fn(),
  listActions: vi.fn(),
  createAction: vi.fn(),
  deleteAction: vi.fn(),
  getActionById: vi.fn(),
  bulkCreateActions: vi.fn(),
  getUserPreferences: vi.fn(),
  upsertUserPreferences: vi.fn(),
  listTeamMembers: vi.fn(),
  getTeamByInviteCode: vi.fn(),
  joinTeamByCode: vi.fn(),
  regenerateInviteCode: vi.fn(),
  updateTeamPlan: vi.fn(),
  listLineupsForMatch: vi.fn(),
  saveLineup: vi.fn(),
  listSubstitutionsForMatch: vi.fn(),
  createSubstitution: vi.fn(),
  deleteSubstitution: vi.fn(),
  listChecklist: vi.fn(),
  toggleChecklistItem: vi.fn(),
  listOpponentTeams: vi.fn(),
  createOpponentTeam: vi.fn(),
  getOpponentTeam: vi.fn(),
  updateOpponentTeam: vi.fn(),
  deleteOpponentTeam: vi.fn(),
  listOpponentPlayers: vi.fn(),
  createOpponentPlayer: vi.fn(),
  updateOpponentPlayer: vi.fn(),
  deleteOpponentPlayer: vi.fn(),
  listTrainingLogs: vi.fn(),
  createTrainingLog: vi.fn(),
}));

// Mock de módulos que dependem de serviços externos
vi.mock("../firestore", () => ({
  mirrorStatus: vi.fn().mockReturnValue(false),
  mirrorAction: vi.fn(),
  mirrorChecklistItem: vi.fn(),
  mirrorDeleteAction: vi.fn(),
}));
vi.mock("../stats", () => ({
  buildDashboard: vi.fn(),
  buildPlayerSummary: vi.fn(),
  buildPostMatch: vi.fn(),
  buildScoutingReport: vi.fn(),
  buildTeamPlayerAggregates: vi.fn(),
}));
vi.mock("../ai/patterns", () => ({ detectPatterns: vi.fn() }));
vi.mock("../ai/training", () => ({ recommendTraining: vi.fn() }));

// Importar depois dos mocks
import * as storage from "../storage";
import { router } from "../routes";

// ── App de teste ──────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

const DEV_UID = "dev-user";

// ── /api/teams ────────────────────────────────────────────────────────────────

describe("GET /api/teams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve lista de equipas do utilizador autenticado", async () => {
    const mockTeams = [{ id: "t1", name: "Equipa A" }];
    vi.mocked(storage.listTeamsForUser).mockResolvedValue(mockTeams as any);

    const app = buildApp();
    const res = await request(app).get("/api/teams");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockTeams);
    expect(storage.listTeamsForUser).toHaveBeenCalledWith(DEV_UID);
  });
});

describe("POST /api/teams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria equipa com dados válidos → 201", async () => {
    const newTeam = {
      id: "t1",
      name: "Sporting",
      club: "Sporting CP",
      category: "Sénior Feminino",
    };
    vi.mocked(storage.createTeam).mockResolvedValue(newTeam as any);

    const app = buildApp();
    const res = await request(app)
      .post("/api/teams")
      .send({ name: "Sporting", club: "Sporting CP", category: "Sénior Feminino" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Sporting");
    expect(storage.createTeam).toHaveBeenCalledWith(
      DEV_UID,
      expect.objectContaining({ name: "Sporting", ownerUid: DEV_UID }),
    );
  });

  it("dados inválidos (sem name) → 400", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/teams")
      .send({ club: "Sporting CP" }); // sem name e category

    expect(res.status).toBe(400);
    expect(storage.createTeam).not.toHaveBeenCalled();
  });
});

// ── /api/players ──────────────────────────────────────────────────────────────

describe("GET /api/players", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem teamId → 400", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/players");
    expect(res.status).toBe(400);
  });

  it("teamId sem acesso → 403", async () => {
    vi.mocked(storage.userBelongsToTeam).mockResolvedValue(false);
    const app = buildApp();
    const res = await request(app).get("/api/players?teamId=t1");
    expect(res.status).toBe(403);
  });

  it("teamId com acesso → devolve jogadores", async () => {
    vi.mocked(storage.userBelongsToTeam).mockResolvedValue(true);
    const players = [{ id: "p1", firstName: "Ana", lastName: "Silva" }];
    vi.mocked(storage.listPlayers).mockResolvedValue(players as any);

    const app = buildApp();
    const res = await request(app).get("/api/players?teamId=t1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(players);
    expect(storage.listPlayers).toHaveBeenCalledWith("t1");
  });
});

describe("POST /api/players", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria jogador com dados válidos → 201", async () => {
    vi.mocked(storage.userBelongsToTeam).mockResolvedValue(true);
    const created = { id: "p1", firstName: "Ana", lastName: "Silva", number: 10, position: "OH", teamId: "t1" };
    vi.mocked(storage.createPlayer).mockResolvedValue(created as any);

    const app = buildApp();
    const res = await request(app)
      .post("/api/players")
      .send({ firstName: "Ana", lastName: "Silva", number: 10, position: "OH", teamId: "t1" });

    expect(res.status).toBe(201);
    expect(res.body.firstName).toBe("Ana");
  });

  it("posição inválida → 400", async () => {
    vi.mocked(storage.userBelongsToTeam).mockResolvedValue(true);
    const app = buildApp();
    const res = await request(app)
      .post("/api/players")
      .send({ firstName: "Ana", lastName: "Silva", number: 10, position: "INVALID", teamId: "t1" });

    expect(res.status).toBe(400);
    expect(storage.createPlayer).not.toHaveBeenCalled();
  });
});

// ── /api/matches ──────────────────────────────────────────────────────────────

describe("GET /api/matches", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem teamId → 400", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/matches");
    expect(res.status).toBe(400);
  });

  it("teamId com acesso → devolve jogos", async () => {
    vi.mocked(storage.userBelongsToTeam).mockResolvedValue(true);
    const matches = [{ id: "m1", opponent: "Benfica", teamId: "t1" }];
    vi.mocked(storage.listMatches).mockResolvedValue(matches as any);

    const app = buildApp();
    const res = await request(app).get("/api/matches?teamId=t1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(matches);
  });
});

// ── /api/user/preferences ────────────────────────────────────────────────────

describe("GET /api/user/preferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem preferências guardadas → devolve pt-PT por defeito", async () => {
    vi.mocked(storage.getUserPreferences).mockResolvedValue(null as any);
    const app = buildApp();
    const res = await request(app).get("/api/user/preferences");
    expect(res.status).toBe(200);
    expect(res.body.language).toBe("pt-PT");
  });

  it("com preferência guardada → devolve o idioma guardado", async () => {
    vi.mocked(storage.getUserPreferences).mockResolvedValue({ uid: DEV_UID, language: "en", updatedAt: new Date() });
    const app = buildApp();
    const res = await request(app).get("/api/user/preferences");
    expect(res.status).toBe(200);
    expect(res.body.language).toBe("en");
  });
});

describe("PATCH /api/user/preferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("idioma válido → 200 e guarda", async () => {
    vi.mocked(storage.upsertUserPreferences).mockResolvedValue({ uid: DEV_UID, language: "es", updatedAt: new Date() });
    const app = buildApp();
    const res = await request(app)
      .patch("/api/user/preferences")
      .send({ language: "es" });
    expect(res.status).toBe(200);
    expect(res.body.language).toBe("es");
    expect(storage.upsertUserPreferences).toHaveBeenCalledWith(DEV_UID, "es");
  });

  it("idioma inválido → 400", async () => {
    const app = buildApp();
    const res = await request(app)
      .patch("/api/user/preferences")
      .send({ language: "zh" }); // não suportado
    expect(res.status).toBe(400);
    expect(storage.upsertUserPreferences).not.toHaveBeenCalled();
  });

  it("todos os idiomas suportados são aceites", async () => {
    const app = buildApp();
    for (const lang of ["pt-PT", "en", "es", "fr"]) {
      vi.mocked(storage.upsertUserPreferences).mockResolvedValue({ uid: DEV_UID, language: lang, updatedAt: new Date() });
      const res = await request(app)
        .patch("/api/user/preferences")
        .send({ language: lang });
      expect(res.status).toBe(200);
    }
  });
});

// ── /api/actions ──────────────────────────────────────────────────────────────

describe("POST /api/actions", () => {
  beforeEach(() => vi.clearAllMocks());

  const validAction = {
    matchId: "m1",
    type: "attack",
    result: "kill",
    side: "home",
    rotation: 1,
    setNumber: 1,
    rallyId: "r1",
    playerId: "p1",
    zoneFrom: null,
    zoneTo: null,
  };

  it("acção válida com acesso ao jogo → 201", async () => {
    vi.mocked(storage.getMatchById).mockResolvedValue({ id: "m1", teamId: "t1" } as any);
    vi.mocked(storage.userBelongsToTeam).mockResolvedValue(true);
    vi.mocked(storage.createAction).mockResolvedValue({ id: "a1", ...validAction } as any);

    const app = buildApp();
    const res = await request(app).post("/api/actions").send(validAction);

    expect(res.status).toBe(201);
    expect(storage.createAction).toHaveBeenCalled();
  });

  it("jogo não encontrado → 404", async () => {
    vi.mocked(storage.getMatchById).mockResolvedValue(null as any);

    const app = buildApp();
    const res = await request(app).post("/api/actions").send(validAction);

    expect(res.status).toBe(404);
  });

  it("sem acesso ao jogo → 403", async () => {
    vi.mocked(storage.getMatchById).mockResolvedValue({ id: "m1", teamId: "t1" } as any);
    vi.mocked(storage.userBelongsToTeam).mockResolvedValue(false);

    const app = buildApp();
    const res = await request(app).post("/api/actions").send(validAction);

    expect(res.status).toBe(403);
  });

  it("tipo de acção inválido → 400", async () => {
    vi.mocked(storage.getMatchById).mockResolvedValue({ id: "m1", teamId: "t1" } as any);
    vi.mocked(storage.userBelongsToTeam).mockResolvedValue(true);

    const app = buildApp();
    const res = await request(app)
      .post("/api/actions")
      .send({ ...validAction, type: "tackle" }); // não é um ActionType

    expect(res.status).toBe(400);
    expect(storage.createAction).not.toHaveBeenCalled();
  });
});

// ── /api/config ───────────────────────────────────────────────────────────────

describe("GET /api/config", () => {
  it("devolve status do mirror", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/config");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("mirror");
  });
});

// ── Tenancy (segurança cross-team) ────────────────────────────────────────────

describe("Tenancy — isolamento entre equipas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("utilizador sem acesso à equipa não vê jogadores", async () => {
    vi.mocked(storage.userBelongsToTeam).mockResolvedValue(false);

    const app = buildApp();
    const res = await request(app).get("/api/players?teamId=outra-equipa");

    expect(res.status).toBe(403);
    expect(storage.listPlayers).not.toHaveBeenCalled();
  });

  it("utilizador sem acesso à equipa não cria jogos", async () => {
    vi.mocked(storage.userBelongsToTeam).mockResolvedValue(false);

    const app = buildApp();
    const res = await request(app)
      .post("/api/matches")
      .send({ teamId: "outra-equipa", opponent: "Benfica", date: new Date().toISOString(), venue: "home" });

    expect(res.status).toBe(403);
    expect(storage.createMatch).not.toHaveBeenCalled();
  });

  it("utilizador sem acesso não vê acções de um jogo", async () => {
    vi.mocked(storage.getMatchById).mockResolvedValue({ id: "m1", teamId: "outra-equipa" } as any);
    vi.mocked(storage.userBelongsToTeam).mockResolvedValue(false);

    const app = buildApp();
    const res = await request(app).get("/api/matches/m1/actions");

    expect(res.status).toBe(403);
    expect(storage.listActions).not.toHaveBeenCalled();
  });
});
