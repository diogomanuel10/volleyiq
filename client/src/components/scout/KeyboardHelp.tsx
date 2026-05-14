import { useEffect, useState } from "react";
import {
  Gauge,
  HelpCircle,
  Keyboard,
  LifeBuoy,
  PlayCircle,
  Users,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export type ScoutHelpTab =
  | "quickstart"
  | "shortcuts"
  | "modes"
  | "lineup"
  | "faq";

function K({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1.5 rounded border bg-muted text-[11px] font-mono">
      {children}
    </kbd>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
        {n}
      </div>
      <div className="space-y-1">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

export function KeyboardHelp({
  open,
  onOpenChange,
  initialTab = "shortcuts",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Default tab to open (useful when coming from the welcome banner). */
  initialTab?: ScoutHelpTab;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ScoutHelpTab>(initialTab);

  // Whenever the dialog reopens, respect the requested tab.
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const shortcutSections: Array<{ title: string; rows: Array<[React.ReactNode, string]> }> = [
    {
      title: t("keyboardHelp.shortcuts.always"),
      rows: [
        [
          <>
            <K>Ctrl</K>+<K>Z</K> / <K>⌫</K>
          </>,
          t("keyboardHelp.shortcuts.undoAction"),
        ],
        [<K>Esc</K>, t("keyboardHelp.shortcuts.cancelSelection")],
        [<K>?</K>, t("keyboardHelp.shortcuts.toggleHelp")],
      ],
    },
    {
      title: t("keyboardHelp.shortcuts.choosePlayer"),
      rows: [
        [
          <>
            <K>0</K>–<K>9</K>
          </>,
          t("keyboardHelp.shortcuts.jerseyNumber"),
        ],
      ],
    },
    {
      title: t("keyboardHelp.shortcuts.chooseAction"),
      rows: [
        [<K>1</K>, t("keyboardHelp.shortcuts.serve")],
        [<K>2</K>, t("keyboardHelp.shortcuts.reception")],
        [<K>3</K>, t("keyboardHelp.shortcuts.set")],
        [<K>4</K>, t("keyboardHelp.shortcuts.attack")],
        [<K>5</K>, t("keyboardHelp.shortcuts.block")],
        [<K>6</K>, t("keyboardHelp.shortcuts.defense")],
      ],
    },
    {
      title: t("keyboardHelp.shortcuts.chooseZone"),
      rows: [
        [
          <>
            <K>1</K>…<K>9</K>
          </>,
          t("keyboardHelp.shortcuts.zoneNumber"),
        ],
        [<K>Space</K>, t("keyboardHelp.shortcuts.skipZone")],
      ],
    },
    {
      title: t("keyboardHelp.shortcuts.result"),
      rows: [
        [<K>#</K>, t("keyboardHelp.shortcuts.perfectKillAce")],
        [<K>+</K>, t("keyboardHelp.shortcuts.goodInPlay")],
        [<K>-</K>, t("keyboardHelp.shortcuts.weakBlocked")],
        [<K>/</K>, t("keyboardHelp.shortcuts.tooled")],
        [<K>!</K>, t("keyboardHelp.shortcuts.neutralInPlay")],
        [<K>=</K>, t("keyboardHelp.shortcuts.error")],
      ],
    },
  ];

  const faqItems = [
    { q: t("keyboardHelp.faq.q1"), a: t("keyboardHelp.faq.a1") },
    {
      q: t("keyboardHelp.faq.q2"),
      a: (
        <>
          {t("keyboardHelp.faq.a2").split("⌫").map((part, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>
                {part}
                <K>⌫</K>
              </span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </>
      ),
    },
    { q: t("keyboardHelp.faq.q3"), a: t("keyboardHelp.faq.a3") },
    { q: t("keyboardHelp.faq.q4"), a: t("keyboardHelp.faq.a4") },
    { q: t("keyboardHelp.faq.q5"), a: t("keyboardHelp.faq.a5") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4" /> {t("keyboardHelp.title")}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ScoutHelpTab)}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="quickstart">
              <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
              {t("keyboardHelp.tabs.quickstart")}
            </TabsTrigger>
            <TabsTrigger value="shortcuts">
              <Keyboard className="h-3.5 w-3.5 mr-1.5" />
              {t("keyboardHelp.tabs.shortcuts")}
            </TabsTrigger>
            <TabsTrigger value="modes">
              <Gauge className="h-3.5 w-3.5 mr-1.5" />
              {t("keyboardHelp.tabs.modes")}
            </TabsTrigger>
            <TabsTrigger value="lineup">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              {t("keyboardHelp.tabs.lineup")}
            </TabsTrigger>
            <TabsTrigger value="faq">
              <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
              {t("keyboardHelp.tabs.faq")}
            </TabsTrigger>
          </TabsList>

          {/* ── Quick start ─────────────────────────────────────────── */}
          <TabsContent value="quickstart">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("keyboardHelp.quickstart.intro")}
              </p>
              <div className="space-y-3">
                <Step n={1} title={t("keyboardHelp.quickstart.step1Title")}>
                  {t("keyboardHelp.quickstart.step1")}
                </Step>
                <Step n={2} title={t("keyboardHelp.quickstart.step2Title")}>
                  {t("keyboardHelp.quickstart.step2")}
                </Step>
                <Step n={3} title={t("keyboardHelp.quickstart.step3Title")}>
                  {t("keyboardHelp.quickstart.step3Lite")}
                </Step>
                <Step n={4} title={t("keyboardHelp.quickstart.step4Title")}>
                  <K>Ctrl</K>+<K>Z</K> / <K>⌫</K> {t("keyboardHelp.quickstart.step4")} <K>Esc</K>.
                </Step>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                💡 {t("keyboardHelp.quickstart.autoSave")}
              </div>
            </div>
          </TabsContent>

          {/* ── Shortcuts ──────────────────────────────────────────── */}
          <TabsContent value="shortcuts">
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {shortcutSections.map((sec) => (
                <div key={sec.title} className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {sec.title}
                  </div>
                  <ul className="space-y-1">
                    {sec.rows.map(([keys, label], i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-1">{keys}</span>
                        <span className="text-muted-foreground text-xs text-right">
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-3">
              {t("keyboardHelp.shortcuts.contextNote")}
            </p>
          </TabsContent>

          {/* ── Modes ────────────────────────────────────────────────── */}
          <TabsContent value="modes">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <div className="font-semibold text-sm">{t("keyboardHelp.modes.liteTitle")}</div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("keyboardHelp.modes.liteDesc")}
                </p>
                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                  <li>{t("keyboardHelp.modes.lite4steps")}</li>
                  <li>{t("keyboardHelp.modes.liteZoneOptional")}</li>
                  <li>{t("keyboardHelp.modes.liteAllPlans")}</li>
                </ul>
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" />
                  <div className="font-semibold text-sm">{t("keyboardHelp.modes.completeTitle")}</div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("keyboardHelp.modes.completeDesc")}
                </p>
                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                  <li>{t("keyboardHelp.modes.complete5steps")}</li>
                  <li>{t("keyboardHelp.modes.completeSuggestion")}</li>
                  <li>{t("keyboardHelp.modes.completeProPlan")}</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              💡 {t("keyboardHelp.modes.switchNote")}
            </div>
          </TabsContent>

          {/* ── Lineup & Subs ────────────────────────────────────────── */}
          <TabsContent value="lineup">
            <div className="space-y-3 text-sm">
              <div>
                <div className="font-semibold mb-1">{t("keyboardHelp.lineup.setLineupTitle")}</div>
                <p className="text-xs text-muted-foreground">
                  {t("keyboardHelp.lineup.setLineupDesc")}
                </p>
              </div>
              <div>
                <div className="font-semibold mb-1">{t("keyboardHelp.lineup.subsTitle")}</div>
                <p className="text-xs text-muted-foreground">
                  {t("keyboardHelp.lineup.subsDesc")}
                </p>
              </div>
              <div>
                <div className="font-semibold mb-1">{t("keyboardHelp.lineup.serveRotationTitle")}</div>
                <p className="text-xs text-muted-foreground">
                  {t("keyboardHelp.lineup.serveRotationDesc")}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                💡 {t("keyboardHelp.lineup.perSetNote")}
              </div>
            </div>
          </TabsContent>

          {/* ── FAQ ──────────────────────────────────────────────────── */}
          <TabsContent value="faq">
            <ul className="space-y-3">
              {faqItems.map((item, i) => (
                <li key={i} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="font-semibold text-sm mb-1">{item.q}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
