import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { Lineup, Player } from "@shared/schema";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  matchId: string;
  setNumber: number;
  rotation: number;
  roster: Player[];
  existing: Lineup | null;
  onSaved: (lineup: Lineup) => void;
}

export function LineupWizard({
  open,
  onOpenChange,
  matchId,
  setNumber,
  rotation,
  roster,
  existing,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const sortedRoster = useMemo(
    () => [...roster].sort((a, b) => a.number - b.number),
    [roster],
  );

  const [slots, setSlots] = useState<Array<string | null>>(() => [
    existing?.p1 ?? null,
    existing?.p2 ?? null,
    existing?.p3 ?? null,
    existing?.p4 ?? null,
    existing?.p5 ?? null,
    existing?.p6 ?? null,
  ]);
  const [liberoReception, setLiberoReception] = useState<string | null>(
    () => existing?.liberoReceptionId ?? null,
  );
  const [liberoDefense, setLiberoDefense] = useState<string | null>(
    () => existing?.liberoDefenseId ?? null,
  );

  useEffect(() => {
    setSlots([
      existing?.p1 ?? null,
      existing?.p2 ?? null,
      existing?.p3 ?? null,
      existing?.p4 ?? null,
      existing?.p5 ?? null,
      existing?.p6 ?? null,
    ]);
    setLiberoReception(existing?.liberoReceptionId ?? null);
    setLiberoDefense(existing?.liberoDefenseId ?? null);
  }, [existing, setNumber]);

  const save = useMutation({
    mutationFn: () =>
      api.post<Lineup>(`/api/matches/${matchId}/lineups`, {
        setNumber,
        rotation,
        p1: slots[0],
        p2: slots[1],
        p3: slots[2],
        p4: slots[3],
        p5: slots[4],
        p6: slots[5],
        liberoReceptionId: liberoReception,
        liberoDefenseId: liberoDefense,
      }),
    onSuccess: (l) => {
      toast.success(t("livescout.lineupSaved", { set: setNumber }));
      onSaved(l);
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error(t("livescout.lineupSaveError"), {
        description: err instanceof Error ? err.message : String(err),
      }),
  });

  function setSlot(i: number, id: string | null) {
    setSlots((prev) => {
      const next = [...prev];
      next[i] = id;
      if (id) {
        for (let j = 0; j < 6; j++) {
          if (j !== i && next[j] === id) next[j] = null;
        }
      }
      return next;
    });
  }

  const slotIds = new Set(slots.filter(Boolean) as string[]);
  const filled = slots.filter(Boolean).length;

  const positions = [
    { idx: 0, labelKey: "livescout.lineupPositions.p1" },
    { idx: 1, labelKey: "livescout.lineupPositions.p2" },
    { idx: 2, labelKey: "livescout.lineupPositions.p3" },
    { idx: 3, labelKey: "livescout.lineupPositions.p4" },
    { idx: 4, labelKey: "livescout.lineupPositions.p5" },
    { idx: 5, labelKey: "livescout.lineupPositions.p6" },
  ];

  function playerOption(pl: Player) {
    return `#${pl.number} ${pl.firstName} ${pl.lastName} · ${pl.position}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("livescout.lineupTitle", { set: setNumber })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("livescout.lineupDescription")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {positions.map((p) => (
              <div key={p.idx} className="space-y-1">
                <Label htmlFor={`slot-${p.idx}`} className="text-xs">
                  {t(p.labelKey)}
                </Label>
                <Select
                  id={`slot-${p.idx}`}
                  value={slots[p.idx] ?? ""}
                  onChange={(e) => setSlot(p.idx, e.target.value || null)}
                >
                  <option value="">— {t("livescout.choose")} —</option>
                  {sortedRoster.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {playerOption(pl)}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground">
            {t("livescout.lineupProgress", { filled, total: 6 })}{filled === 6 ? " ✓" : ""}
          </div>

          {/* ── Liberos ──────────────────────────────────────────── */}
          <div className="border-t pt-4 space-y-3">
            <div>
              <p className="text-sm font-medium">{t("livescout.liberosTitle")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("livescout.liberosDescription")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="libero-rec" className="text-xs">
                  {t("livescout.liberoReception")}
                  <span className="ml-1 text-muted-foreground">
                    ({t("livescout.liberoReceptionHint")})
                  </span>
                </Label>
                <Select
                  id="libero-rec"
                  value={liberoReception ?? ""}
                  onChange={(e) =>
                    setLiberoReception(e.target.value || null)
                  }
                >
                  <option value="">— {t("livescout.none")} —</option>
                  {sortedRoster
                    .filter(
                      (pl) =>
                        !slotIds.has(pl.id) ||
                        pl.id === liberoReception,
                    )
                    .map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {playerOption(pl)}
                      </option>
                    ))}
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="libero-def" className="text-xs">
                  {t("livescout.liberoDefense")}
                  <span className="ml-1 text-muted-foreground">
                    ({t("livescout.liberoDefenseHint")})
                  </span>
                </Label>
                <Select
                  id="libero-def"
                  value={liberoDefense ?? ""}
                  onChange={(e) =>
                    setLiberoDefense(e.target.value || null)
                  }
                >
                  <option value="">— {t("livescout.none")} —</option>
                  {sortedRoster
                    .filter(
                      (pl) =>
                        !slotIds.has(pl.id) ||
                        pl.id === liberoDefense,
                    )
                    .map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {playerOption(pl)}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={filled !== 6 || save.isPending}
          >
            {save.isPending ? t("common.saving") : t("livescout.saveLineup")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
