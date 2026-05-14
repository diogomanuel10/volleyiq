import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronRight,
  Radio,
  Upload,
  CalendarPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerImportDialog } from "@/components/PlayerImportDialog";
import { api } from "@/lib/api";
import type { Match } from "@shared/schema";
import { cn } from "@/lib/utils";

interface Props {
  teamId: string;
  teamName: string;
  playersCount: number;
  matchId: string | null;
  matchesCount: number;
  existingPlayerNumbers: number[];
}

export function SetupGuide({
  teamId,
  teamName,
  playersCount,
  matchId,
  matchesCount,
  existingPlayerNumbers,
}: Props) {
  const { t } = useTranslation();
  const [importOpen, setImportOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);

  const steps = [
    {
      id: "team",
      done: true,
      icon: Check,
      title: t("setupGuide.steps.team.title"),
      detail: teamName,
      action: null,
    },
    {
      id: "players",
      done: playersCount > 0,
      icon: Users,
      title: t("setupGuide.steps.players.title"),
      detail:
        playersCount > 0
          ? t("setupGuide.steps.players.detailDone", { count: playersCount })
          : t("setupGuide.steps.players.detail"),
      action:
        playersCount === 0 ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 shrink-0"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" /> {t("setupGuide.steps.players.action")}
          </Button>
        ) : null,
    },
    {
      id: "match",
      done: matchesCount > 0,
      icon: CalendarPlus,
      title: t("setupGuide.steps.match.title"),
      detail:
        matchesCount > 0
          ? t("setupGuide.steps.match.detailDone", { count: matchesCount })
          : t("setupGuide.steps.match.detail"),
      action:
        matchesCount === 0 ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 shrink-0"
            onClick={() => setMatchOpen(true)}
          >
            <CalendarPlus className="h-3.5 w-3.5" /> {t("setupGuide.steps.match.action")}
          </Button>
        ) : null,
    },
    {
      id: "scout",
      done: false,
      icon: Radio,
      title: t("setupGuide.steps.scout.title"),
      detail: t("setupGuide.steps.scout.detail"),
      action:
        matchId ? (
          <Button
            size="sm"
            className="gap-1.5 shrink-0"
            asChild
          >
            <Link href={`/scout/${matchId}`}>
              <Radio className="h-3.5 w-3.5" /> {t("setupGuide.steps.scout.action")}
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" disabled>
            <Radio className="h-3.5 w-3.5" /> {t("setupGuide.steps.scout.needMatch")}
          </Button>
        ),
    },
  ] as const;

  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <>
      <div className="rounded-xl border bg-card p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-base">{t("setupGuide.title")}</h2>
            <p
              className="text-xs text-muted-foreground mt-0.5"
              dangerouslySetInnerHTML={{ __html: t("setupGuide.subtitle") }}
            />
          </div>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {done}/{steps.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* Steps */}
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <AnimatePresence key={step.id} mode="popLayout">
              <motion.li
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  step.done
                    ? "bg-emerald-50 dark:bg-emerald-950/20"
                    : "bg-muted/40",
                )}
              >
                {/* Step indicator */}
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    step.done
                      ? "bg-emerald-500 text-white"
                      : "bg-muted-foreground/20 text-muted-foreground",
                  )}
                >
                  {step.done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    i + 1
                  )}
                </span>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "font-medium leading-tight",
                      step.done && "text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {step.detail}
                  </p>
                </div>

                {/* Action / check */}
                {step.done ? (
                  <ChevronRight className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  step.action
                )}
              </motion.li>
            </AnimatePresence>
          ))}
        </ol>

        {/* Skip link */}
        <p className="text-xs text-center text-muted-foreground">
          {t("setupGuide.exploreFirst")}{" "}
          <Link href="/players" className="underline underline-offset-2">
            {t("setupGuide.viewRoster")}
          </Link>{" "}
          ·{" "}
          <Link href="/matches" className="underline underline-offset-2">
            {t("setupGuide.viewMatches")}
          </Link>
        </p>
      </div>

      {/* Dialogs */}
      <PlayerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        teamId={teamId}
        existingNumbers={existingPlayerNumbers}
      />
      <QuickMatchDialog
        open={matchOpen}
        onOpenChange={setMatchOpen}
        teamId={teamId}
      />
    </>
  );
}

// ── Quick match dialog ───────────────────────────────────────────────────────

function QuickMatchDialog({
  open,
  onOpenChange,
  teamId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teamId: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  const create = useMutation({
    mutationFn: () =>
      api.post<Match>("/api/matches", {
        teamId,
        opponent: opponent.trim(),
        date: new Date(date).toISOString(),
        venue: "home",
        setsWon: 0,
        setsLost: 0,
        status: "scheduled",
      }),
    onSuccess: () => {
      toast.success(t("setupGuide.quickMatch.created"));
      qc.invalidateQueries({ queryKey: ["matches"] });
      onOpenChange(false);
      setOpponent("");
    },
    onError: (err: any) =>
      toast.error(err.message ?? t("setupGuide.quickMatch.createError")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("setupGuide.quickMatch.title")}</DialogTitle>
          <DialogDescription>
            {t("setupGuide.quickMatch.description")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!opponent.trim()) {
              toast.error(t("setupGuide.quickMatch.opponentRequired"));
              return;
            }
            create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="qm-opponent">{t("setupGuide.quickMatch.opponent")}</Label>
            <Input
              id="qm-opponent"
              autoFocus
              placeholder={t("setupGuide.quickMatch.opponentPlaceholder")}
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              disabled={create.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qm-date">{t("setupGuide.quickMatch.date")}</Label>
            <Input
              id="qm-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={create.isPending}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t("setupGuide.quickMatch.creating") : t("setupGuide.quickMatch.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
