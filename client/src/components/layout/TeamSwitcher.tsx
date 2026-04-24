import { ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTeam } from "@/hooks/useTeam";
import { cn } from "@/lib/utils";

interface Props {
  collapsed?: boolean;
}

export function TeamSwitcher({ collapsed = false }: Props) {
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
    return <div className="h-9 rounded-md bg-muted animate-pulse" />;
  }
  if (!team) return null;

  const initials = team.name.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? team.name : undefined}
        className={cn(
          "w-full flex items-center rounded-md border bg-background text-sm hover:bg-accent transition-colors",
          collapsed ? "justify-center h-9" : "justify-between gap-2 px-3 h-9",
        )}
      >
        <div
          className={cn(
            "flex items-center min-w-0",
            collapsed ? "" : "gap-2",
          )}
        >
          <div className="h-6 w-6 rounded-md bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">
            {initials}
          </div>
          {!collapsed && <span className="truncate">{team.name}</span>}
        </div>
        {!collapsed && (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div
          className={cn(
            "absolute z-30 top-full mt-1 rounded-md border bg-card text-card-foreground shadow-md py-1",
            collapsed ? "left-full ml-1 min-w-[180px]" : "left-0 right-0",
          )}
        >
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
