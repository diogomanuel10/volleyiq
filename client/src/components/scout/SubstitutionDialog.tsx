import { useState } from "react";
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
import type { Player, Substitution } from "@shared/schema";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  matchId: string;
  setNumber: number;
  homeScore: number;
  awayScore: number;
  onCourt: Player[];
  bench: Player[];
  onCreated: (sub: Substitution) => void;
}

export function SubstitutionDialog({
  open,
  onOpenChange,
  matchId,
  setNumber,
  homeScore,
  awayScore,
  onCourt,
  bench,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const [outId, setOutId] = useState<string>("");
  const [inId, setInId] = useState<string>("");

  const create = useMutation({
    mutationFn: () =>
      api.post<Substitution>(`/api/matches/${matchId}/substitutions`, {
        setNumber,
        homeScore,
        awayScore,
        playerInId: inId,
        playerOutId: outId,
      }),
    onSuccess: (sub) => {
      toast.success(t("livescout.substitutionRegistered"));
      onCreated(sub);
      setOutId("");
      setInId("");
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error(t("common.error"), {
        description: err instanceof Error ? err.message : String(err),
      }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setOutId("");
          setInId("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("livescout.substitutionTitle", { set: setNumber })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sub-out" className="text-xs">
              {t("livescout.substitutionOut")}
            </Label>
            <Select
              id="sub-out"
              value={outId}
              onChange={(e) => setOutId(e.target.value)}
            >
              <option value="">— {t("livescout.choose")} —</option>
              {onCourt.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.firstName} {p.lastName} · {p.position}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="sub-in" className="text-xs">
              {t("livescout.substitutionIn")}
            </Label>
            <Select
              id="sub-in"
              value={inId}
              onChange={(e) => setInId(e.target.value)}
            >
              <option value="">— {t("livescout.choose")} —</option>
              {bench.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.firstName} {p.lastName} · {p.position}
                </option>
              ))}
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("livescout.substitutionScore", { home: homeScore, away: awayScore })}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => create.mutate()}
            disabled={!inId || !outId || create.isPending}
          >
            {create.isPending ? t("common.saving") : t("livescout.confirmSubstitution")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
