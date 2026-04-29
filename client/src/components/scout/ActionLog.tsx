import { motion, AnimatePresence } from "framer-motion";
import { Undo2 } from "lucide-react";
import type { LoggedAction } from "@/hooks/useScoutState";
import type { Player } from "@shared/schema";
import {
  ACTION_LABEL,
  RESULT_LABEL,
  RESULT_COLOR,
  getDvCode
} from "@shared/types";
import { Button } from "@/components/ui/button";

export function ActionLog({
  log,
  players,
  onUndo,
}: {
  log: LoggedAction[];
  players: Player[];
  onUndo: () => void;
}) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const recent = [...log].slice(-12).reverse();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Log ({log.length})
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={!log.length}
        >
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        <AnimatePresence initial={false}>
          {recent.map((a) => {
            const p = byId.get(a.playerId);
            const dv = getDvCode(a.type, a.result);
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs"
              >
                <span className="w-8 font-bold text-center tabular-nums">
                  {p ? `#${p.number}` : "?"}
                </span>
                <span className="flex-1 truncate">
                  {ACTION_LABEL[a.type]}
                  {a.zoneTo ? ` → Z${a.zoneTo}` : ""}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${RESULT_COLOR[a.result]}`}
                >
                  {dv ? `${dv} ${RESULT_LABEL[a.result]}` : RESULT_LABEL[a.result]}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!recent.length && (
          <div className="text-xs text-muted-foreground text-center py-8">
            Ainda sem acções registadas.
          </div>
        )}
      </div>
    </div>
  );
}
