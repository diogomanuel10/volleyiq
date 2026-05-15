import { describe, it, expect } from "vitest";
import { getEffectiveLineup, getActiveLiberoId } from "@/lib/libero";
import type { Player } from "@shared/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlayer(id: string, position: Player["position"]): Player {
  return {
    id,
    teamId: "team1",
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

const OH1 = makePlayer("p1", "OH");
const MB1 = makePlayer("p2", "MB");
const MB2 = makePlayer("p3", "MB");
const S1  = makePlayer("p4", "S");
const OPP = makePlayer("p5", "OPP");
const OH2 = makePlayer("p6", "OH");
const LIB = makePlayer("p7", "L");

/**
 * Lineup base convencional: slots P1..P6 (índices 0-5).
 * R=1: P1=OH1, P2=MB1, P3=S1, P4=OH2, P5=MB2, P6=OPP
 */
const BASE_SLOTS: (Player | null)[] = [OH1, MB1, S1, OH2, MB2, OPP];

function makeMap(...players: Player[]): Map<string, Player> {
  return new Map(players.map((p) => [p.id, p]));
}

// ── getActiveLiberoId ─────────────────────────────────────────────────────────

describe("getActiveLiberoId", () => {
  it("away serves (recepção) → líbero de recepção", () => {
    expect(getActiveLiberoId("away", "libRec", "libDef")).toBe("libRec");
  });

  it("home serves (serviço) → líbero de defesa", () => {
    expect(getActiveLiberoId("home", "libRec", "libDef")).toBe("libDef");
  });

  it("sem líbero → null", () => {
    expect(getActiveLiberoId("away", null, null)).toBeNull();
    expect(getActiveLiberoId("home", undefined, undefined)).toBeNull();
  });
});

// ── getEffectiveLineup — sem líbero ──────────────────────────────────────────

describe("getEffectiveLineup — sem líbero", () => {
  const map = makeMap(OH1, MB1, MB2, S1, OPP, OH2);

  it("sem liberoId → devolve slots inalterados", () => {
    const result = getEffectiveLineup(BASE_SLOTS, 1, "home", map, null, null);
    expect(result).toEqual(BASE_SLOTS);
  });

  it("líbero não encontrado no mapa → slots inalterados", () => {
    const result = getEffectiveLineup(BASE_SLOTS, 1, "home", map, "unknown-id", null);
    expect(result).toEqual(BASE_SLOTS);
  });
});

// ── getEffectiveLineup — receção (away serves) ────────────────────────────────

describe("getEffectiveLineup — recepção (away serves)", () => {
  const map = makeMap(OH1, MB1, MB2, S1, OPP, OH2, LIB);

  it("R=1, P1 (slot 0) tem OH → nenhum MB em back-row na pos P1; P5 e P6 verificados", () => {
    // R=1: slot[(P-R+6)%6]
    // P1: slot[0]=OH1 → não MB
    // P5: slot[(5-1+6)%6]=slot[4]=MB2 → líbero substitui slot 4
    // P6: slot[(6-1+6)%6]=slot[5]=OPP → não MB
    const result = getEffectiveLineup(BASE_SLOTS, 1, "away", map, LIB.id, null);
    expect(result[4]).toEqual(LIB); // slot 4 = P5 em R=1
    // os outros slots ficam inalterados
    expect(result[0]).toEqual(OH1);
    expect(result[1]).toEqual(MB1);
  });

  it("R=1, P1 tem MB: líbero substitui P1 (recepção permite P1)", () => {
    const slotsWithMBatP1: (Player | null)[] = [MB1, OH1, S1, OH2, MB2, OPP];
    // P1: slot[0]=MB1 → líbero entra em slot 0
    const result = getEffectiveLineup(slotsWithMBatP1, 1, "away", map, LIB.id, null);
    expect(result[0]).toEqual(LIB);
  });

  it("R=2: slots de back-row mudam conforme rotação", () => {
    // R=2: P1=slot[(1-2+6)%6]=slot[5]=OPP, P5=slot[(5-2+6)%6]=slot[3]=OH2, P6=slot[(6-2+6)%6]=slot[4]=MB2
    // MB2 está em slot 4 (P6 em R=2) → líbero entra em slot 4
    const result = getEffectiveLineup(BASE_SLOTS, 2, "away", map, LIB.id, null);
    expect(result[4]).toEqual(LIB);
  });
});

// ── getEffectiveLineup — serviço (home serves) ───────────────────────────────

describe("getEffectiveLineup — serviço (home serves)", () => {
  const map = makeMap(OH1, MB1, MB2, S1, OPP, OH2, LIB);

  it("R=1, P1 (slot 0) tem OH → P5 slot[4]=MB2 → líbero entra em slot 4", () => {
    // Serving: apenas P5 e P6 são verificados (P1 é o servidor)
    const result = getEffectiveLineup(BASE_SLOTS, 1, "home", map, null, LIB.id);
    expect(result[4]).toEqual(LIB);
  });

  it("R=1, MB em P1 (servidor) → líbero NÃO substitui P1", () => {
    const slotsWithMBatP1: (Player | null)[] = [MB1, OH1, S1, OH2, MB2, OPP];
    // P1 tem MB mas é o servidor — não pode ser substituído pela líbero
    // P5=slot[4]=MB2 → líbero entra em slot 4
    const result = getEffectiveLineup(slotsWithMBatP1, 1, "home", map, null, LIB.id);
    expect(result[0]).toEqual(MB1); // slot 0 intacto
    expect(result[4]).toEqual(LIB); // slot 4 substituído
  });

  it("nenhum MB em back-row → resultado igual ao base", () => {
    // Todos OH/OPP/S no back-row
    const noMBBack: (Player | null)[] = [OH1, OH2, S1, OH1, OPP, OPP];
    const result = getEffectiveLineup(noMBBack, 1, "home", map, null, LIB.id);
    expect(result).toEqual(noMBBack);
  });
});

// ── Slots com nulls ───────────────────────────────────────────────────────────

describe("getEffectiveLineup — slots com nulls", () => {
  const map = makeMap(LIB);

  it("slots com null não causam erro", () => {
    const nullSlots: (Player | null)[] = [null, null, null, null, null, null];
    const result = getEffectiveLineup(nullSlots, 1, "away", map, LIB.id, null);
    expect(result).toEqual(nullSlots);
  });
});
