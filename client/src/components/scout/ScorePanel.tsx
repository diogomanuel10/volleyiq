import { ChevronLeft, ChevronRight, Minus, Plus, RotateCw, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Side = "home" | "away";

export function ScorePanel({
  homeScore,
  awayScore,
  setNumber,
  rotation,
  servingTeam,
  onAdjust,
  onRotate,
  onSetServingTeam,
  onPrevSet,
  onNextSet,
}: {
  homeScore: number;
  awayScore: number;
  setNumber: number;
  rotation: number;
  servingTeam: Side;
  onAdjust: (side: Side, delta: 1 | -1) => void;
  onRotate: (direction: 1 | -1) => void;
  onSetServingTeam: (team: Side) => void;
  onPrevSet: () => void;
  onNextSet: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrevSet}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            SET {setNumber}
          </Badge>
          <Button variant="outline" size="icon" onClick={onNextSet}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-help">
                Rot. {rotation}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              Posição do distribuidor: P{rotation}. Avança automaticamente
              em side-out (quando ganhamos o serviço); podes também forçar
              com a seta.
            </TooltipContent>
          </Tooltip>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onRotate(1)}
            aria-label="Próxima rotação"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ScoreBlock
          label="Nós"
          score={homeScore}
          onInc={() => onAdjust("home", 1)}
          onDec={() => onAdjust("home", -1)}
          serving={servingTeam === "home"}
          onClickServe={() => onSetServingTeam("home")}
          accent="primary"
        />
        <ScoreBlock
          label="Adversário"
          score={awayScore}
          onInc={() => onAdjust("away", 1)}
          onDec={() => onAdjust("away", -1)}
          serving={servingTeam === "away"}
          onClickServe={() => onSetServingTeam("away")}
          accent="muted"
        />
      </div>
    </div>
  );
}

function ScoreBlock({
  label,
  score,
  onInc,
  onDec,
  serving,
  onClickServe,
  accent,
}: {
  label: string;
  score: number;
  onInc: () => void;
  onDec: () => void;
  serving: boolean;
  onClickServe: () => void;
  accent: "primary" | "muted";
}) {
  return (
    <div
      className={cn(
        "relative rounded-lg p-3 transition-all",
        accent === "primary"
          ? "border-2 border-primary/30 bg-primary/5"
          : "border bg-muted/30",
        serving && "ring-2 ring-amber-500/70 ring-offset-1 ring-offset-background",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClickServe}
              aria-label={serving ? "A servir" : "Marcar como serviço"}
              className={cn(
                "h-5 w-5 rounded-full flex items-center justify-center transition-colors",
                serving
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-amber-500/20",
              )}
            >
              <Volleyball className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {serving
              ? "A servir actualmente"
              : "Carrega para corrigir quem está a servir"}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center justify-between mt-1">
        <Button variant="ghost" size="icon" onClick={onDec} aria-label="Menos">
          <Minus className="h-4 w-4" />
        </Button>
        <div className="text-4xl font-bold tabular-nums">{score}</div>
        <Button variant="ghost" size="icon" onClick={onInc} aria-label="Mais">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
