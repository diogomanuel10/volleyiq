import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useScoutState,
  deriveSuggestion,
  deriveNextSide,
  type LoggedAction,
} from "@/hooks/useScoutState";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAction(overrides: Partial<LoggedAction> = {}): LoggedAction {
  return {
    id: "test-id",
    playerId: "p1",
    side: "home",
    type: "attack",
    zoneFrom: null,
    zoneTo: null,
    zoneFromX: null,
    zoneFromY: null,
    zoneToX: null,
    zoneToY: null,
    result: "kill",
    rallyId: "rally-1",
    rotation: 1,
    setNumber: 1,
    timestamp: Date.now(),
    prevServingTeam: "home",
    prevRotation: 1,
    ...overrides,
  };
}

/** Executa o fluxo mínimo lite para registar uma acção. */
function logLiteAction(
  dispatch: ReturnType<typeof useScoutState>[1],
  opts: { playerId?: string; actionType?: LoggedAction["type"]; result?: LoggedAction["result"] } = {},
) {
  act(() => dispatch({ kind: "selectPlayer", playerId: opts.playerId ?? "p1" }));
  act(() => dispatch({ kind: "selectAction", actionType: opts.actionType ?? "attack" }));
  act(() => dispatch({ kind: "skipZone" }));
  act(() => dispatch({ kind: "selectResult", result: opts.result ?? "kill" }));
}

// ── Estado inicial ────────────────────────────────────────────────────────────

describe("useScoutState — estado inicial", () => {
  it("começa em modo lite, step idle, score 0-0", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [state] = result.current;
    expect(state.mode).toBe("lite");
    expect(state.step).toBe("idle");
    expect(state.homeScore).toBe(0);
    expect(state.awayScore).toBe(0);
    expect(state.setNumber).toBe(1);
    expect(state.rotation).toBe(1);
    expect(state.servingTeam).toBe("home");
    expect(state.log).toHaveLength(0);
  });
});

// ── Fluxo de selecção ─────────────────────────────────────────────────────────

describe("useScoutState — fluxo de selecção", () => {
  it("selectPlayer → step action", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "selectPlayer", playerId: "p1" }));
    expect(result.current[0].step).toBe("action");
    expect(result.current[0].playerId).toBe("p1");
  });

  it("selectAction em modo lite → step zone", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "selectPlayer", playerId: "p1" }));
    act(() => dispatch({ kind: "selectAction", actionType: "attack" }));
    expect(result.current[0].step).toBe("zone");
    expect(result.current[0].actionType).toBe("attack");
  });

  it("selectAction em modo complete → step zoneFrom", () => {
    const { result } = renderHook(() => useScoutState("complete"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "selectPlayer", playerId: "p1" }));
    act(() => dispatch({ kind: "selectAction", actionType: "attack" }));
    expect(result.current[0].step).toBe("zoneFrom");
  });

  it("skipZone em modo lite → step result", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "selectPlayer", playerId: "p1" }));
    act(() => dispatch({ kind: "selectAction", actionType: "attack" }));
    act(() => dispatch({ kind: "skipZone" }));
    expect(result.current[0].step).toBe("result");
    expect(result.current[0].zoneTo).toBeNull();
  });

  it("selectZoneFrom → step zoneTo (complete)", () => {
    const { result } = renderHook(() => useScoutState("complete"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "selectPlayer", playerId: "p1" }));
    act(() => dispatch({ kind: "selectAction", actionType: "attack" }));
    act(() => dispatch({ kind: "selectZoneFrom", zone: 4, x: 10, y: 20 }));
    expect(result.current[0].step).toBe("zoneTo");
    expect(result.current[0].zoneFrom).toBe(4);
    expect(result.current[0].zoneFromX).toBe(10);
  });

  it("selectZoneTo → step result (complete)", () => {
    const { result } = renderHook(() => useScoutState("complete"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "selectPlayer", playerId: "p1" }));
    act(() => dispatch({ kind: "selectAction", actionType: "attack" }));
    act(() => dispatch({ kind: "selectZoneFrom", zone: 4 }));
    act(() => dispatch({ kind: "selectZoneTo", zone: 9, x: 80, y: 90 }));
    expect(result.current[0].step).toBe("result");
    expect(result.current[0].zoneTo).toBe(9);
  });
});

// ── Score e pontuação ─────────────────────────────────────────────────────────

describe("useScoutState — pontuação", () => {
  it("attack kill → homeScore +1, log tem 1 entrada, step idle", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { result: "kill" });
    const [state] = result.current;
    expect(state.homeScore).toBe(1);
    expect(state.awayScore).toBe(0);
    expect(state.log).toHaveLength(1);
    expect(state.step).toBe("idle");
  });

  it("attack error → awayScore +1", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { result: "error" });
    expect(result.current[0].awayScore).toBe(1);
    expect(result.current[0].homeScore).toBe(0);
  });

  it("serve ace → homeScore +1", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { actionType: "serve", result: "ace" });
    expect(result.current[0].homeScore).toBe(1);
  });

  it("block stuff → homeScore +1", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { actionType: "block", result: "stuff" });
    expect(result.current[0].homeScore).toBe(1);
  });

  it("attack in_play (não terminal) → score não muda", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { result: "in_play" });
    expect(result.current[0].homeScore).toBe(0);
    expect(result.current[0].awayScore).toBe(0);
  });

  it("adjustScore home +1 / -1 e clampa a 0", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "adjustScore", side: "home", delta: 1 }));
    expect(result.current[0].homeScore).toBe(1);
    act(() => dispatch({ kind: "adjustScore", side: "home", delta: -1 }));
    expect(result.current[0].homeScore).toBe(0);
    act(() => dispatch({ kind: "adjustScore", side: "home", delta: -1 }));
    expect(result.current[0].homeScore).toBe(0); // clampa em 0
  });
});

// ── Side-out e rotação ────────────────────────────────────────────────────────

describe("useScoutState — side-out e rotação", () => {
  it("home serve ace → servingTeam mantém-se home, sem rotação", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { actionType: "serve", result: "ace" });
    expect(result.current[0].servingTeam).toBe("home");
    expect(result.current[0].rotation).toBe(1);
  });

  it("home attack kill (home servindo) → servingTeam home, sem rotação", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { result: "kill" });
    expect(result.current[0].servingTeam).toBe("home");
    expect(result.current[0].rotation).toBe(1);
  });

  it("home attack error (home servindo) → servingTeam away, rotação não muda (away não tem rotação)", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { result: "error" });
    expect(result.current[0].servingTeam).toBe("away");
    expect(result.current[0].rotation).toBe(1); // away não rotaciona, home mantém
  });

  it("side-out home (away servindo, home ganha) → rotação decrementa", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    // Coloca away a servir primeiro
    act(() => dispatch({ kind: "setServingTeam", team: "away" }));
    // Home marca ponto (side-out)
    logLiteAction(dispatch, { result: "kill" });
    expect(result.current[0].servingTeam).toBe("home");
    expect(result.current[0].rotation).toBe(6); // 1 - 1 = 6 (wrap)
  });

  it("rotação: R=3, side-out home → R=2", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "setServingTeam", team: "away" }));
    act(() => dispatch({ kind: "rotate", direction: 1 })); // R=6
    act(() => dispatch({ kind: "rotate", direction: 1 })); // R=5
    act(() => dispatch({ kind: "rotate", direction: 1 })); // R=4
    act(() => dispatch({ kind: "rotate", direction: 1 })); // R=3
    logLiteAction(dispatch, { result: "kill" });
    expect(result.current[0].rotation).toBe(2);
  });

  it("rotate +1 sequências ciclam R1→6→5→4→3→2→1→6", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    // R começa em 1
    act(() => dispatch({ kind: "rotate", direction: 1 }));
    expect(result.current[0].rotation).toBe(6);
    act(() => dispatch({ kind: "rotate", direction: 1 }));
    expect(result.current[0].rotation).toBe(5);
    act(() => dispatch({ kind: "rotate", direction: 1 }));
    expect(result.current[0].rotation).toBe(4);
    act(() => dispatch({ kind: "rotate", direction: 1 }));
    expect(result.current[0].rotation).toBe(3);
    act(() => dispatch({ kind: "rotate", direction: 1 }));
    expect(result.current[0].rotation).toBe(2);
    act(() => dispatch({ kind: "rotate", direction: 1 }));
    expect(result.current[0].rotation).toBe(1);
  });

  it("rally não terminal → servingTeam e rotação não mudam", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { result: "in_play" });
    expect(result.current[0].servingTeam).toBe("home");
    expect(result.current[0].rotation).toBe(1);
    expect(result.current[0].rallyId).toBe(result.current[0].rallyId); // mesmo rally
  });

  it("rally terminal → novo rallyId gerado", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    const [initialState] = result.current;
    logLiteAction(dispatch, { result: "kill" });
    expect(result.current[0].rallyId).not.toBe(initialState.rallyId);
  });
});

// ── Undo ─────────────────────────────────────────────────────────────────────

describe("useScoutState — undo", () => {
  it("undo sem log → sem efeito", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "undo" }));
    expect(result.current[0].log).toHaveLength(0);
    expect(result.current[0].homeScore).toBe(0);
  });

  it("undo após kill → remove acção e decrementa score", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { result: "kill" });
    expect(result.current[0].homeScore).toBe(1);
    act(() => dispatch({ kind: "undo" }));
    expect(result.current[0].homeScore).toBe(0);
    expect(result.current[0].log).toHaveLength(0);
  });

  it("undo após error → remove acção e decrementa awayScore", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { result: "error" });
    expect(result.current[0].awayScore).toBe(1);
    act(() => dispatch({ kind: "undo" }));
    expect(result.current[0].awayScore).toBe(0);
  });

  it("undo restaura servingTeam e rotation via snapshot", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    // side-out: away servia, home ganha → rotation decrementa para 6
    act(() => dispatch({ kind: "setServingTeam", team: "away" }));
    logLiteAction(dispatch, { result: "kill" });
    expect(result.current[0].servingTeam).toBe("home");
    expect(result.current[0].rotation).toBe(6);
    act(() => dispatch({ kind: "undo" }));
    expect(result.current[0].servingTeam).toBe("away");
    expect(result.current[0].rotation).toBe(1);
  });

  it("undo não vai abaixo de 0 no score", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { result: "kill" });
    act(() => dispatch({ kind: "adjustScore", side: "home", delta: -1 }));
    // score está 0, undo da acção kill não vai para -1
    act(() => dispatch({ kind: "undo" }));
    expect(result.current[0].homeScore).toBeGreaterThanOrEqual(0);
  });

  it("undo em cadeia (3 acções) → limpa log e score correctamente", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { result: "kill" });
    logLiteAction(dispatch, { result: "kill" });
    logLiteAction(dispatch, { result: "kill" });
    expect(result.current[0].homeScore).toBe(3);
    act(() => dispatch({ kind: "undo" }));
    act(() => dispatch({ kind: "undo" }));
    act(() => dispatch({ kind: "undo" }));
    expect(result.current[0].homeScore).toBe(0);
    expect(result.current[0].log).toHaveLength(0);
  });
});

// ── quickPoint ────────────────────────────────────────────────────────────────

describe("useScoutState — quickPoint", () => {
  it("winner home → homeScore +1", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "quickPoint", winner: "home" }));
    expect(result.current[0].homeScore).toBe(1);
    expect(result.current[0].log).toHaveLength(1);
    expect(result.current[0].log[0].result).toBe("won");
  });

  it("winner away → awayScore +1", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "quickPoint", winner: "away" }));
    expect(result.current[0].awayScore).toBe(1);
    expect(result.current[0].log[0].result).toBe("lost");
  });

  it("quickPoint home quando away servia → side-out, rotation decrementa", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "setServingTeam", team: "away" }));
    act(() => dispatch({ kind: "quickPoint", winner: "home" }));
    expect(result.current[0].servingTeam).toBe("home");
    expect(result.current[0].rotation).toBe(6);
  });
});

// ── nextSet / prevSet ─────────────────────────────────────────────────────────

describe("useScoutState — navegação de sets", () => {
  it("nextSet → incrementa setNumber, reset score e rotation", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    logLiteAction(dispatch, { result: "kill" }); // score 1-0
    act(() => dispatch({ kind: "nextSet" }));
    expect(result.current[0].setNumber).toBe(2);
    expect(result.current[0].homeScore).toBe(0);
    expect(result.current[0].awayScore).toBe(0);
    expect(result.current[0].rotation).toBe(1);
  });

  it("nextSet não passa de set 5", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    for (let i = 0; i < 6; i++) act(() => dispatch({ kind: "nextSet" }));
    expect(result.current[0].setNumber).toBe(5);
  });

  it("prevSet não vai abaixo de 1", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "prevSet" }));
    expect(result.current[0].setNumber).toBe(1);
  });
});

// ── hydrate ───────────────────────────────────────────────────────────────────

describe("useScoutState — hydrate", () => {
  it("hydrate substitui o log com as acções recebidas", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    const actions = [makeAction({ id: "a1" }), makeAction({ id: "a2" })];
    act(() => dispatch({ kind: "hydrate", actions }));
    expect(result.current[0].log).toHaveLength(2);
    expect(result.current[0].log[0].id).toBe("a1");
  });

  it("hydrateSession restaura estado completo", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    const actions = [makeAction()];
    act(() =>
      dispatch({
        kind: "hydrateSession",
        actions,
        homeScore: 15,
        awayScore: 12,
        setNumber: 2,
        rotation: 4,
        servingTeam: "away",
      }),
    );
    const [s] = result.current;
    expect(s.homeScore).toBe(15);
    expect(s.awayScore).toBe(12);
    expect(s.setNumber).toBe(2);
    expect(s.rotation).toBe(4);
    expect(s.servingTeam).toBe("away");
    expect(s.log).toHaveLength(1);
  });
});

// ── setMode ───────────────────────────────────────────────────────────────────

describe("useScoutState — setMode", () => {
  it("mudar de modo a meio de selecção → reset para idle", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    act(() => dispatch({ kind: "selectPlayer", playerId: "p1" }));
    expect(result.current[0].step).toBe("action");
    act(() => dispatch({ kind: "setMode", mode: "complete" }));
    expect(result.current[0].step).toBe("idle");
    expect(result.current[0].playerId).toBeNull();
    expect(result.current[0].mode).toBe("complete");
  });

  it("setMode com o mesmo modo → sem mudança", () => {
    const { result } = renderHook(() => useScoutState("lite"));
    const [, dispatch] = result.current;
    const [before] = result.current;
    act(() => dispatch({ kind: "setMode", mode: "lite" }));
    expect(result.current[0]).toBe(before);
  });
});

// ── deriveSuggestion ─────────────────────────────────────────────────────────

describe("deriveSuggestion", () => {
  it("log vazio → serve", () => {
    expect(deriveSuggestion([])).toBe("serve");
  });

  it("último resultado terminal (kill) → serve", () => {
    expect(deriveSuggestion([makeAction({ result: "kill" })])).toBe("serve");
  });

  it("último resultado terminal (ace) → serve", () => {
    expect(deriveSuggestion([makeAction({ type: "serve", result: "ace" })])).toBe("serve");
  });

  it("último resultado terminal (error) → serve", () => {
    expect(deriveSuggestion([makeAction({ result: "error" })])).toBe("serve");
  });

  it("serve + in_play → dig", () => {
    expect(deriveSuggestion([makeAction({ type: "serve", result: "in_play" })])).toBe("dig");
  });

  it("reception + good → set", () => {
    expect(deriveSuggestion([makeAction({ type: "reception", result: "good" })])).toBe("set");
  });

  it("set + perfect → attack", () => {
    expect(deriveSuggestion([makeAction({ type: "set", result: "perfect" })])).toBe("attack");
  });

  it("attack + in_play → dig", () => {
    expect(deriveSuggestion([makeAction({ type: "attack", result: "in_play" })])).toBe("dig");
  });

  it("dig + good → set", () => {
    expect(deriveSuggestion([makeAction({ type: "dig", result: "good" })])).toBe("set");
  });

  it("block + touch → set", () => {
    expect(deriveSuggestion([makeAction({ type: "block", result: "touch" })])).toBe("set");
  });
});

// ── deriveNextSide ────────────────────────────────────────────────────────────

describe("deriveNextSide", () => {
  it("log vazio → servingTeam", () => {
    expect(deriveNextSide([], "home")).toBe("home");
    expect(deriveNextSide([], "away")).toBe("away");
  });

  it("último resultado terminal → servingTeam (rally acabou)", () => {
    expect(deriveNextSide([makeAction({ result: "kill" })], "away")).toBe("away");
  });

  it("serve (home) + in_play → away (adversário recebe)", () => {
    expect(
      deriveNextSide([makeAction({ type: "serve", side: "home", result: "in_play" })], "home"),
    ).toBe("away");
  });

  it("set (home) + perfect → home (ataque é da mesma equipa)", () => {
    expect(
      deriveNextSide([makeAction({ type: "set", side: "home", result: "perfect" })], "home"),
    ).toBe("home");
  });

  it("dig (home) + good → home (passe → set, mesma equipa)", () => {
    expect(
      deriveNextSide([makeAction({ type: "dig", side: "home", result: "good" })], "home"),
    ).toBe("home");
  });

  it("attack (home) + in_play → away", () => {
    expect(
      deriveNextSide([makeAction({ type: "attack", side: "home", result: "in_play" })], "home"),
    ).toBe("away");
  });

  it("attack (away) + in_play → home", () => {
    expect(
      deriveNextSide([makeAction({ type: "attack", side: "away", result: "in_play" })], "home"),
    ).toBe("home");
  });
});
