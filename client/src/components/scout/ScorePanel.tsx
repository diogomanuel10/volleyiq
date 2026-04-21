import { ChevronLeft, ChevronRight, Minus, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ScorePanel({
  homeScore,
  awayScore,
  setNumber,
  rotation,
  onAdjust,
  onRotate,
  onPrevSet,
  onNextSet,
}: {
  homeScore: number;
  awayScore: number;
  setNumber: number;
  rotation: number;
  onAdjust: (side: "home" | "away", delta: 1 | -1) => void;
  onRotate: (direction: 1 | -1) => void;
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
          <Badge variant="outline">Rot. {rotation}</Badge>
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
          accent="primary"
        />
        <ScoreBlock
          label="Adversário"
          score={awayScore}
          onInc={() => onAdjust("away", 1)}
          onDec={() => onAdjust("away", -1)}
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
  accent,
}: {
  label: string;
  score: number;
  onInc: () => void;
  onDec: () => void;
  accent: "primary" | "muted";
}) {
  return (
    <div
      className={
        accent === "primary"
          ? "rounded-lg border-2 border-primary/30 bg-primary/5 p-3"
          : "rounded-lg border bg-muted/30 p-3"
      }
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
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
