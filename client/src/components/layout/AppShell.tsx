import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { TrialBanner } from "@/components/TrialBanner";
import { TrialExpiredGate } from "@/components/TrialExpiredGate";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full overflow-x-hidden">
      <div className="print-hide contents">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="print-hide">
          <TrialBanner />
          <TopBar />
        </div>
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 lg:pb-0 print-area">
          <TrialExpiredGate>
            {children}
          </TrialExpiredGate>
        </main>
        <div className="print-hide">
          <MobileNav />
        </div>
      </div>
    </div>
  );
}
