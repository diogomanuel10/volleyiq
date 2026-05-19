import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Radio,
  Trophy,
  Users,
  ClipboardCheck,
  UsersRound,
  CalendarDays,
  FileText,
  Shuffle,
  Sparkles,
  Settings,
  UserCircle,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { Building2 } from "lucide-react";

const NAV_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  liveScout: "Live Scout",
  matches: "Jogos",
  players: "Jogadores",
  athletes: "Atletas",
  opponents: "Adversários",
  matchDay: "Match Day",
  scoutingReport: "Scouting Report",
  scenario: "Scenario",
  postMatch: "Post-Match",
  pricing: "Pricing",
  settings: "Definições",
  profile: "Perfil",
  reports: "Relatório",
};

const primaryNavKeys = [
  { href: "/", icon: LayoutDashboard, key: "dashboard" },
  { href: "/scout", icon: Radio, key: "liveScout" },
  { href: "/matches", icon: Trophy, key: "matches" },
  { href: "/players", icon: Users, key: "athletes" },
  { href: "/matchday", icon: ClipboardCheck, key: "matchDay" },
];

const allNavKeys = [
  { href: "/", icon: LayoutDashboard, key: "dashboard" },
  { href: "/scout", icon: Radio, key: "liveScout" },
  { href: "/matches", icon: Trophy, key: "matches" },
  { href: "/players", icon: Users, key: "players" },
  { href: "/opponents", icon: UsersRound, key: "opponents" },
  { href: "/matchday", icon: ClipboardCheck, key: "matchDay" },
  { href: "/reports", icon: FileText, key: "scoutingReport" },
  { href: "/scenario", icon: Shuffle, key: "scenario" },
  { href: "/post-match", icon: CalendarDays, key: "postMatch" },
  { href: "/pricing", icon: Sparkles, key: "pricing" },
  { href: "/settings", icon: Settings, key: "settings" },
  { href: "/profile", icon: UserCircle, key: "profile" },
];

export function MobileNav() {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const guard = usePlanGuard();
  const clubNav = guard.meetsMinimum("club")
    ? [{ href: "/club", icon: Building2, key: "clubDashboard" as const, label: "Club Dashboard" }]
    : [];
  const extendedNav = [...allNavKeys, ...clubNav];

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 border-t bg-card/95 backdrop-blur">
        <ul className="grid grid-cols-6">
          {primaryNavKeys.map((it) => {
            const active =
              it.href === "/"
                ? location === "/"
                : location === it.href || location.startsWith(it.href + "/");
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px]",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <it.icon className="h-5 w-5" />
                  {NAV_LABELS[it.key] ?? it.key}
                </Link>
              </li>
            );
          })}
          {/* "More" button */}
          <li>
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-full flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-muted-foreground"
            >
              <Menu className="h-5 w-5" />
              Mais
            </button>
          </li>
        </ul>
      </nav>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30"
          onClick={() => setDrawerOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Drawer panel */}
          <div
            className="absolute bottom-0 inset-x-0 bg-card rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
              <span className="font-semibold text-sm">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* All options */}
            <ul className="p-3 grid grid-cols-1 gap-0.5 pb-8">
              {extendedNav.map((it) => {
                const active =
                  it.href === "/"
                    ? location === "/"
                    : location === it.href || location.startsWith(it.href + "/");
                const label = "label" in it ? String(it.label) : (NAV_LABELS[it.key] ?? it.key);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <it.icon className="h-5 w-5 shrink-0" />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
