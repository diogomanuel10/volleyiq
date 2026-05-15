import { describe, it, expect } from "vitest";
import { buildSuggestions, type PlayerAggregate, type ScoutingHistory } from "@/lib/suggestions";
import type { LoggedAction } from "@/hooks/useScoutState";
import type { Player } from "@shared/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

let idCounter = 0;
function makeAction(
  overrides: Partial<LoggedAction> = {},
): LoggedAction {
  idCounter++;
  return {
    id: `a${idCounter}`,
    playerId: "p1",
    side: "home",
    type: "attack",
    zoneFrom: null,
    zoneTo: null,
    zoneFromX: null,
    zoneFromY: null,
    zoneToX: null,
    zoneToY: null,
    result: "in_play",
    rallyId: "r1",
    rotation: 1,
    setNumber: 1,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makePlayer(id: string, position: Player["position"] = "OH"): Player {
  return {
    id,
    teamId: "t1",
    firstName: "Player",
    lastName: id,
    number: parseInt(id.replace("p", ""), 10),
    position,
    heightCm: null,
    dominantHand: null,
    birthDate: null,
    active: true,
  };
}

function makeAgg(playerId: string, overrides: Partial<PlayerAggregate> = {}): PlayerAggregate {
  return {
    playerId,
    matchesPlayed: 3,
    attacks: { total: 10, kills: 5, errors: 2 },
    serves: { total: 10, aces: 2, errors: 1 },
    receptions: { total: 10, perfect: 4, good: 4, poor: 1, error: 1 },
    ...overrides,
  };
}

const DEFAULT_HISTORY: ScoutingHistory = {
  sampleMatches: 2,
  rotationSideOut: [
    { rotation: "R1", pct: 65 },
    { rotation: "R2", pct: 35 },
    { rotation: "R3", pct: 50 },
  ],
  attackZones: [
    { zone: "4", count: 40 },
    { zone: "2", count: 15 },
    { zone: "9", count: 15 },
  ],
};

const BASE_ARGS = {
  rotation: 1,
  servingTeam: "home" as const,
  setNumber: 1,
  players: [makePlayer("p1"), makePlayer("p2"), makePlayer("p3")],
  history: null,
  onCourt: [],
  bench: [],
  playerAggregates: [],
};

// ── liveHotScorer ─────────────────────────────────────────────────────────────

describe("buildSuggestions — scorer em alta forma", () => {
  it("≥3 ataques com kill%≥60 → sugestão scorer high", () => {
    const log = [
      makeAction({ type: "attack", result: "kill" }),
      makeAction({ type: "attack", result: "kill" }),
      makeAction({ type: "attack", result: "kill" }),
    ];
    const result = buildSuggestions({ ...BASE_ARGS, log });
    const scorer = result.find((s) => s.category === "scorer");
    expect(scorer).toBeDefined();
    expect(scorer?.priority).toBe("high");
    expect(scorer?.source).toBe("live");
  });

  it("<3 ataques → sem sugestão scorer", () => {
    const log = [
      makeAction({ type: "attack", result: "kill" }),
      makeAction({ type: "attack", result: "kill" }),
    ];
    const result = buildSuggestions({ ...BASE_ARGS, log });
    expect(result.find((s) => s.category === "scorer")).toBeUndefined();
  });

  it("3 ataques mas kill%=33% (<60) → sem sugestão scorer", () => {
    const log = [
      makeAction({ type: "attack", result: "kill" }),
      makeAction({ type: "attack", result: "error" }),
      makeAction({ type: "attack", result: "blocked" }),
    ];
    const result = buildSuggestions({ ...BASE_ARGS, log });
    expect(result.find((s) => s.category === "scorer")).toBeUndefined();
  });
});

// ── liveColdStreak ────────────────────────────────────────────────────────────

describe("buildSuggestions — cold streak", () => {
  it("2 últimos ataques error/blocked → sugestão cold medium", () => {
    const log = [
      makeAction({ type: "attack", result: "kill" }),   // bom
      makeAction({ type: "attack", result: "error" }),  // mau
      makeAction({ type: "attack", result: "blocked" }), // mau
    ];
    const result = buildSuggestions({ ...BASE_ARGS, log });
    const cold = result.find((s) => s.category === "cold");
    expect(cold).toBeDefined();
    expect(cold?.priority).toBe("medium");
  });

  it("1 ataque mau → sem sugestão cold", () => {
    const log = [makeAction({ type: "attack", result: "blocked" })];
    const result = buildSuggestions({ ...BASE_ARGS, log });
    expect(result.find((s) => s.category === "cold")).toBeUndefined();
  });

  it("2 últimos ataques bons → sem sugestão cold", () => {
    const log = [
      makeAction({ type: "attack", result: "error" }),
      makeAction({ type: "attack", result: "kill" }),
      makeAction({ type: "attack", result: "kill" }),
    ];
    const result = buildSuggestions({ ...BASE_ARGS, log });
    expect(result.find((s) => s.category === "cold")).toBeUndefined();
  });
});

// ── liveReceptionTarget ───────────────────────────────────────────────────────

describe("buildSuggestions — alvo de recepção", () => {
  it("3/4 últimas recepções para o mesmo jogador → sugestão reception high", () => {
    const log = [
      makeAction({ type: "reception", playerId: "p1", result: "good" }),
      makeAction({ type: "reception", playerId: "p2", result: "good" }),
      makeAction({ type: "reception", playerId: "p1", result: "good" }),
      makeAction({ type: "reception", playerId: "p1", result: "poor" }),
      makeAction({ type: "reception", playerId: "p1", result: "poor" }),
    ];
    const result = buildSuggestions({ ...BASE_ARGS, log });
    const rec = result.find((s) => s.category === "reception");
    expect(rec).toBeDefined();
    expect(rec?.priority).toBe("high");
  });

  it("<4 recepções no total → sem sugestão reception", () => {
    const log = [
      makeAction({ type: "reception", playerId: "p1", result: "poor" }),
      makeAction({ type: "reception", playerId: "p1", result: "poor" }),
      makeAction({ type: "reception", playerId: "p1", result: "poor" }),
    ];
    const result = buildSuggestions({ ...BASE_ARGS, log });
    expect(result.find((s) => s.category === "reception")).toBeUndefined();
  });
});

// ── liveSetterBias ────────────────────────────────────────────────────────────

describe("buildSuggestions — distribuição enviesada", () => {
  it("≥60% ataques para o mesmo jogador (≥6 total) → sugestão setter low", () => {
    const log = Array.from({ length: 6 }, (_, i) =>
      makeAction({ type: "attack", playerId: i < 4 ? "p1" : "p2", result: "kill" }),
    );
    // p1 tem 4/6 = 67%
    const result = buildSuggestions({ ...BASE_ARGS, log });
    const setter = result.find((s) => s.category === "setter");
    expect(setter).toBeDefined();
    expect(setter?.priority).toBe("low");
  });

  it("<6 ataques total → sem sugestão setter", () => {
    const log = Array.from({ length: 5 }, () =>
      makeAction({ type: "attack", playerId: "p1", result: "kill" }),
    );
    const result = buildSuggestions({ ...BASE_ARGS, log });
    expect(result.find((s) => s.category === "setter")).toBeUndefined();
  });
});

// ── historyRotationSideOut ────────────────────────────────────────────────────

describe("buildSuggestions — histórico de rotação", () => {
  it("pct≥60 → sugestão rotation medium (forte)", () => {
    const result = buildSuggestions({ ...BASE_ARGS, history: DEFAULT_HISTORY, rotation: 1, log: [] });
    const rot = result.find((s) => s.category === "rotation" && s.id.includes("strong"));
    expect(rot).toBeDefined();
    expect(rot?.priority).toBe("medium");
    expect(rot?.source).toBe("history");
  });

  it("pct<40 → sugestão rotation high (fraca)", () => {
    const result = buildSuggestions({ ...BASE_ARGS, history: DEFAULT_HISTORY, rotation: 2, log: [] });
    const rot = result.find((s) => s.category === "rotation" && s.id.includes("weak"));
    expect(rot).toBeDefined();
    expect(rot?.priority).toBe("high");
  });

  it("pct entre 40-60 → sem sugestão de rotação", () => {
    const result = buildSuggestions({ ...BASE_ARGS, history: DEFAULT_HISTORY, rotation: 3, log: [] });
    expect(result.find((s) => s.category === "rotation")).toBeUndefined();
  });

  it("0 jogos históricos → sem sugestão", () => {
    const noHistory: ScoutingHistory = { ...DEFAULT_HISTORY, sampleMatches: 0 };
    const result = buildSuggestions({ ...BASE_ARGS, history: noHistory, rotation: 1, log: [] });
    expect(result.find((s) => s.category === "rotation")).toBeUndefined();
  });
});

// ── historyAttackTendency ─────────────────────────────────────────────────────

describe("buildSuggestions — tendência de ataque histórica", () => {
  it("zona dominante ≥35% com ≥20 ataques → sugestão tendency low", () => {
    const result = buildSuggestions({ ...BASE_ARGS, history: DEFAULT_HISTORY, log: [] });
    const tend = result.find((s) => s.category === "tendency");
    expect(tend).toBeDefined();
    expect(tend?.priority).toBe("low");
    // 40/70 = 57% → deve aparecer
  });

  it("<20 ataques históricos → sem sugestão tendency", () => {
    const fewAttacks: ScoutingHistory = {
      sampleMatches: 1,
      rotationSideOut: [],
      attackZones: [{ zone: "4", count: 10 }, { zone: "2", count: 5 }],
    };
    const result = buildSuggestions({ ...BASE_ARGS, history: fewAttacks, log: [] });
    expect(result.find((s) => s.category === "tendency")).toBeUndefined();
  });
});

// ── Ordenação e limite ────────────────────────────────────────────────────────

describe("buildSuggestions — ordenação e limite", () => {
  it("devolve no máximo 5 sugestões", () => {
    // log rico que gera múltiplas sugestões
    const log = [
      ...Array.from({ length: 3 }, () => makeAction({ type: "attack", result: "kill" })),
      ...Array.from({ length: 2 }, () => makeAction({ type: "attack", result: "error" })),
      makeAction({ type: "attack", result: "blocked" }),
      ...Array.from({ length: 4 }, () =>
        makeAction({ type: "reception", playerId: "p1", result: "poor" }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makeAction({ type: "attack", playerId: i < 3 ? "p1" : "p2", result: "kill" }),
      ),
    ];
    const result = buildSuggestions({ ...BASE_ARGS, history: DEFAULT_HISTORY, log });
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("high antes de medium antes de low", () => {
    const result = buildSuggestions({ ...BASE_ARGS, history: DEFAULT_HISTORY, rotation: 2, log: [] });
    const priorities = result.map((s) => s.priority);
    const order = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < priorities.length; i++) {
      expect(order[priorities[i]]).toBeGreaterThanOrEqual(order[priorities[i - 1]]);
    }
  });
});
