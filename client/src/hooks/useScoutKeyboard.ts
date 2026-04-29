import { useEffect } from "react";
import { getResultByDv, type DvCode } from "@shared/types";
import type { ScoutState, ScoutDispatch } from "@/hooks/useScoutState";

const DV_KEYS: Record<string, DvCode> = {
  "#": "#",
  "+": "+",
  "-": "-",
  "/": "/",
  "!": "!",
  "=": "=",
};

export function useScoutKeyboard(state: ScoutState, dispatch: ScoutDispatch) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // só queremos atalhos quando estamos no passo de resultado
      if (state.step !== "result" || !state.actionType) return;

      const dv = DV_KEYS[e.key];
      if (!dv) return;

      const result = getResultByDv(state.actionType, dv);
      if (!result) return;

      e.preventDefault();
      dispatch({ kind: "selectResult", result });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.step, state.actionType, dispatch]);
}