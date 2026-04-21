import { Hand, ArrowDownToLine, Send, Shield, Target, Volleyball } from "lucide-react";
import { ACTION_TYPES, ACTION_LABEL, type ActionType } from "@shared/types";
import { cn } from "@/lib/utils";

const ICON: Record<ActionType, React.ComponentType<{ className?: string }>> = {
  serve: Send,
  reception: ArrowDownToLine,
  set: Hand,
  attack: Target,
  block: Shield,
  dig: Volleyball,
};

export function ActionBar({
  value,
  onChange,
  disabled,
}: {
  value: ActionType | null;
  onChange: (t: ActionType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {ACTION_TYPES.map((t) => {
        const Icon = ICON[t];
        const active = value === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            disabled={disabled}
            className={cn(
              "h-20 rounded-lg border flex flex-col items-center justify-center gap-1 text-xs font-medium transition-all no-touch-callout",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                : "bg-card hover:bg-accent active:scale-95",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <Icon className="h-5 w-5" />
            {ACTION_LABEL[t]}
          </button>
        );
      })}
    </div>
  );
}
