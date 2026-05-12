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
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const primaryItems = [
  { href: "/", icon: LayoutDashboard, label: "Dash" },
  { href: "/scout", icon: Radio, label: "Scout" },
  { href: "/matches", icon: Trophy, label: "Jogos" },
  { href: "/players", icon: Users, label: "Atletas" },
  { href: "/matchday", icon: ClipboardCheck, label: "Match Day" },
];

const allItems = [
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

export function MobileNav() {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 border-t bg-card/95 backdrop-blur">
        <ul className="grid grid-cols-6">
          {primaryItems.map((it) => {
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
                  {it.label}
                </Link>
              </li>
            );
          })}
          {/* Botão "Mais" */}
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
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Todas as opções */}
            <ul className="p-3 grid grid-cols-1 gap-0.5 pb-8">
              {allItems.map((it) => {
                const active =
                  it.href === "/"
                    ? location === "/"
                    : location === it.href || location.startsWith(it.href + "/");
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
                      {it.label}
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