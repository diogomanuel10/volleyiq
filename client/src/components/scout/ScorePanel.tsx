import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCw,
  Volleyball,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border bg-card flex items-center gap-2 px-2 py-1.5">
      {/* Set navigator */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onPrevSet}
          aria-label={t("livescout.prevSet")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground tabular-nums px-1">
          {t("livescout.set", { number: setNumber })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onNextSet}
          aria-label={t("livescout.nextSet")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border" aria-hidden />

      {/* Score (center, expands) */}
      <div className="flex-1 flex items-center justify-center gap-2 sm:gap-3">
        <ScoreBlock
          label={t("livescout.side.home")}
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
          label={t("livescout.side.away")}
          score={awayScore}
          onInc={() => onAdjust("away", 1)}
          onDec={() => onAdjust("away", -1)}
          serving={servingTeam === "away"}
          onClickServe={() => onSetServingTeam("away")}
          tone="away"
        />
      </div>

      <div className="h-6 w-px bg-border" aria-hidden />

      {/* Rotation */}
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground tabular-nums px-1 cursor-help">
              {t("livescout.rot")} {rotation}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {t("livescout.rotationTooltip", { rotation })}
          </TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onRotate(1)}
          aria-label={t("livescout.nextRotation")}
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
  const { t } = useTranslation();
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
            aria-label={serving ? t("livescout.serving") : t("livescout.markAsServing")}
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
          {serving ? t("livescout.currentlyServing") : t("livescout.correctServing")}
        </TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onDec}
        aria-label={`${label} -1`}
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
        aria-label={`${label} +1`}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
