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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarCollapsed } from "@/lib/sidebar";
import { TeamSwitcher } from "./TeamSwitcher";

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
];

export function Sidebar() {
  const [location] = useLocation();
  const { collapsed, toggle } = useSidebarCollapsed();
  return (
    <aside
      className={cn(
        "hidden md:flex shrink-0 flex-col border-r bg-card transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "border-b space-y-3",
          collapsed ? "p-2" : "p-4",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed && "justify-center",
          )}
        >
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold shrink-0">
            V
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-tight">VolleyIQ</div>
              <div className="text-[11px] text-muted-foreground">
                Analytics Platform
              </div>
            </div>
          )}
        </div>
        <TeamSwitcher collapsed={collapsed} />
      </div>
      <nav className={cn("flex-1 space-y-0.5", collapsed ? "p-1.5" : "p-2")}>
        {items.map((it) => {
          const active =
            it.href === "/"
              ? location === "/"
              : location === it.href || location.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              title={collapsed ? it.label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm transition-colors",
                collapsed
                  ? "justify-center h-10 w-full"
                  : "gap-3 px-3 py-2",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <it.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{it.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "border-t",
          collapsed ? "p-1.5" : "p-2",
        )}
      >
        <button
          onClick={toggle}
          title={collapsed ? "Expandir menu" : "Colapsar menu"}
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
          className={cn(
            "flex items-center rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full",
            collapsed ? "justify-center h-10" : "gap-3 px-3 py-2",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span>Colapsar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
