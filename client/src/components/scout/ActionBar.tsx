import { Hand, ArrowDownToLine, Send, Shield, Target, Volleyball, Zap } from "lucide-react";
import { ACTION_TYPES, ACTION_LABEL, type ActionType } from "@shared/types";
import { cn } from "@/lib/utils";

const ICON: Record<ActionType, React.ComponentType<{ className?: string }>> = {
  serve: Send,
  reception: ArrowDownToLine,
  set: Hand,
  attack: Target,
  block: Shield,
  dig: Volleyball,
  freeball: Zap, // não aparece na barra; só para satisfazer o tipo
};

const KEY_HINT: Record<ActionType, string> = {
  serve: "1",
  reception: "2",
  set: "3",
  attack: "4",
  block: "5",
  dig: "6",
  freeball: "",
};

// Tipos mostrados na barra — freeball é gerido pelos botões de ponto rápido.
const BAR_TYPES = ACTION_TYPES.filter((t) => t !== "freeball");

export function ActionBar({
  value,
  onChange,
  disabled,
  suggested,
}: {
  value: ActionType | null;
  onChange: (t: ActionType) => void;
  disabled?: boolean;
  /** Se definido, esta acção aparece destacada (anel amarelo pulsante). */
  suggested?: ActionType | null;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {BAR_TYPES.map((t) => {
        const Icon = ICON[t];
        const active = value === t;
        const hint = !active && suggested === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            disabled={disabled}
            className={cn(
              "relative h-20 rounded-lg border flex flex-col items-center justify-center gap-1 text-xs font-medium transition-all no-touch-callout",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                : "bg-card hover:bg-accent active:scale-95",
              hint && "ring-2 ring-amber-500/70 ring-offset-1 ring-offset-background",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <kbd
              className={cn(
                "absolute top-1 left-1 hidden sm:inline-flex h-4 min-w-[1rem] items-center justify-center px-1 rounded text-[10px] font-mono leading-none",
                active
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {KEY_HINT[t]}
            </kbd>
            <Icon className="h-5 w-5" />
            {ACTION_LABEL[t]}
            {hint && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        );
      })}
    </div>
  );
}
