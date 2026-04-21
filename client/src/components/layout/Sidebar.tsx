import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Radio,
  Users,
  CalendarDays,
  FileText,
  Shuffle,
  Trophy,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamSwitcher } from "./TeamSwitcher";

const items = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/scout", icon: Radio, label: "Live Scout" },
  { href: "/matches", icon: Trophy, label: "Jogos" },
  { href: "/players", icon: Users, label: "Jogadores" },
  { href: "/matchday", icon: ClipboardCheck, label: "Match Day" },
  { href: "/reports", icon: FileText, label: "Scouting Report" },
  { href: "/scenario", icon: Shuffle, label: "Scenario" },
  { href: "/post-match", icon: CalendarDays, label: "Post-Match" },
  { href: "/pricing", icon: Sparkles, label: "Pricing" },
];

export function Sidebar() {
  const [location] = useLocation();
  return (
    <aside className="hidden md:flex md:w-60 shrink-0 flex-col border-r bg-card">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">
            V
          </div>
          <div>
            <div className="font-semibold leading-tight">VolleyIQ</div>
            <div className="text-[11px] text-muted-foreground">
              Analytics Platform
            </div>
          </div>
        </div>
        <TeamSwitcher />
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {items.map((it) => {
          const active =
            it.href === "/"
              ? location === "/"
              : location === it.href || location.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
