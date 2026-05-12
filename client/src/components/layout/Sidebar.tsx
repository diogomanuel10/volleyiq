import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Radio,
  Users,
  UsersRound,
  CalendarDays,
  FileText,
  Shuffle,
  Trophy,
  ClipboardCheck,
  Sparkles,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarCollapsed } from "@/lib/sidebar";
import { TeamSwitcher } from "./TeamSwitcher";
import { useRef, useState } from "react";

const items = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/scout", icon: Radio, label: "Live Scout" },
  { href: "/matches", icon: Trophy, label: "Jogos" },
  { href: "/players", icon: Users, label: "Jogadores" },
  { href: "/opponents", icon: UsersRound, label: "Adversários" },
  { href: "/matchday", icon: ClipboardCheck, label: "Match Day" },
  { href: "/reports", icon: FileText, label: "Scouting Report" },
  { href: "/scenario", icon: Shuffle, label: "Scenario" },
  { href: "/post-match", icon: CalendarDays, label: "Post-Match" },
  { href: "/pricing", icon: Sparkles, label: "Pricing" },
  { href: "/settings", icon: Settings, label: "Definições" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { collapsed } = useSidebarCollapsed();
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expande se não estiver collapsed (pin) OU se estiver em hover
  const expanded = !collapsed || hovered;

  function handleMouseEnter() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  }

  function handleMouseLeave() {
    leaveTimer.current = setTimeout(() => setHovered(false), 120);
  }

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "hidden lg:flex shrink-0 flex-col border-r bg-card transition-[width] duration-200 z-30",
        expanded ? "w-60" : "w-16",
      )}
    >
      <div
        className={cn(
          "border-b space-y-3",
          expanded ? "p-4" : "p-2",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            !expanded && "justify-center",
          )}
        >
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold shrink-0">
            V
          </div>
          {expanded && (
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-tight">VolleyIQ</div>
              <div className="text-[11px] text-muted-foreground">
                Analytics Platform
              </div>
            </div>
          )}
        </div>
        <TeamSwitcher collapsed={!expanded} />
      </div>
      <nav className={cn("flex-1 space-y-0.5", expanded ? "p-2" : "p-1.5")}>
        {items.map((it) => {
          const active =
            it.href === "/"
              ? location === "/"
              : location === it.href || location.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              title={!expanded ? it.label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm transition-colors",
                !expanded
                  ? "justify-center h-10 w-full"
                  : "gap-3 px-3 py-2",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <it.icon className="h-4 w-4 shrink-0" />
              {expanded && <span className="truncate">{it.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}