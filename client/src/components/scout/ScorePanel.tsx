import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCw,
  Volleyball,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Side = "home" | "away";

/**
 * Score panel compacto: tudo numa linha. Mantém todas as acções (set ±,
 * ajustar score, rotação, marcar serviço) mas com altura ~50px em vez de
 * ~160px — liberta espaço acima do campo para o ActionBar/ResultBar ficar
 * sempre visível sem scroll.
 */
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
    <div className="rounded-xl border bg-card flex items-center gap-2 px-2 py-1.5">
      {/* Set navigator */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onPrevSet}
          aria-label="Set anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground tabular-nums px-1">
          Set {setNumber}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onNextSet}
          aria-label="Próximo set"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border" aria-hidden />

      {/* Score (centro, expande) */}
      <div className="flex-1 flex items-center justify-center gap-2 sm:gap-3">
        <ScoreBlock
          label="Nós"
          score={homeScore}
          onInc={() => onAdjust("home", 1)}
          onDec={() => onAdjust("home", -1)}
          serving={servingTeam === "home"}
          onClickServe={() => onSetServingTeam("home")}
          tone="home"
        />
        <span className="text-xl font-bold text-muted-foreground/60 tabular-nums">
          –
        </span>
        <ScoreBlock
          label="Adv"
          score={awayScore}
          onInc={() => onAdjust("away", 1)}
          onDec={() => onAdjust("away", -1)}
          serving={servingTeam === "away"}
          onClickServe={() => onSetServingTeam("away")}
          tone="away"
        />
      </div>

      <div className="h-6 w-px bg-border" aria-hidden />

      {/* Rotação */}
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground tabular-nums px-1 cursor-help">
              Rot {rotation}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Posição do distribuidor: P{rotation}. Avança automaticamente em
            side-out; podes forçar com a seta.
          </TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onRotate(1)}
          aria-label="Próxima rotação"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
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
  tone,
}: {
  label: string;
  score: number;
  onInc: () => void;
  onDec: () => void;
  serving: boolean;
  onClickServe: () => void;
  tone: "home" | "away";
}) {
  return (
    <div className="flex items-center gap-1">
      <span
        className={cn(
          "text-[10px] uppercase tracking-wide font-semibold",
          tone === "home" ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClickServe}
            aria-label={serving ? "A servir" : "Marcar como serviço"}
            className={cn(
              "h-4 w-4 rounded-full flex items-center justify-center transition-colors shrink-0",
              serving
                ? "bg-amber-500 text-white"
                : "bg-muted text-muted-foreground hover:bg-amber-500/20",
            )}
          >
            <Volleyball className="h-2.5 w-2.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {serving ? "A servir actualmente" : "Corrigir quem está a servir"}
        </TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onDec}
        aria-label={`${label} menos um`}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <div className="text-2xl font-bold tabular-nums min-w-[1.6ch] text-center">
        {score}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onInc}
        aria-label={`${label} mais um`}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
