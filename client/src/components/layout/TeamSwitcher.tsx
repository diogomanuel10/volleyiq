import { ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTeam } from "@/hooks/useTeam";
import { cn } from "@/lib/utils";

export function TeamSwitcher() {
  const { teams, team, setTeam, isLoading } = useTeam();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (isLoading) {
    return (
      <div className="h-9 rounded-md bg-muted animate-pulse" />
    );
  }
  if (!team) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-md border bg-background px-3 h-9 text-sm hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-md bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">
            {team.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="truncate">{team.name}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md py-1">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTeam(t.id);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-accent",
                t.id === team.id && "font-medium",
              )}
            >
              <span className="truncate">{t.name}</span>
              {t.id === team.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
