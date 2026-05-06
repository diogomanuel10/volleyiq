import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
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

/**
 * Diálogo para definir o lineup inicial de um set: 6 jogadoras + 2 líberos
 * (receção e defesa). O sistema aplica automaticamente a troca do líbero
 * pelo central de trás consoante quem serve.
 */
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
      toast.success(`Lineup do set ${setNumber} guardado`);
      onSaved(l);
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error("Falha a guardar lineup", {
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

  // Liberos não devem ser os mesmos nem estar nos 6 slots.
  const slotIds = new Set(slots.filter(Boolean) as string[]);

  const filled = slots.filter(Boolean).length;

  const positions = [
    { idx: 0, label: "P1 — Serviço (back-direita)" },
    { idx: 1, label: "P2 — Frente-direita" },
    { idx: 2, label: "P3 — Frente-centro" },
    { idx: 3, label: "P4 — Frente-esquerda" },
    { idx: 4, label: "P5 — Back-esquerda" },
    { idx: 5, label: "P6 — Back-centro" },
  ];

  function playerOption(pl: Player) {
    return `#${pl.number} ${pl.firstName} ${pl.lastName} · ${pl.position}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lineup inicial — Set {setNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Escolhe as 6 jogadoras que arrancam este set. O serviço começa
            no P1.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {positions.map((p) => (
              <div key={p.idx} className="space-y-1">
                <Label htmlFor={`slot-${p.idx}`} className="text-xs">
                  {p.label}
                </Label>
                <Select
                  id={`slot-${p.idx}`}
                  value={slots[p.idx] ?? ""}
                  onChange={(e) => setSlot(p.idx, e.target.value || null)}
                >
                  <option value="">— escolher —</option>
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
            {filled} / 6 jogadoras escolhidas{filled === 6 ? " ✓" : ""}
          </div>

          {/* ── Líberos ──────────────────────────────────────────── */}
          <div className="border-t pt-4 space-y-3">
            <div>
              <p className="text-sm font-medium">Líberos (opcional)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                O sistema troca automaticamente o central de trás pelo líbero
                correto consoante quem serve. O líbero não conta nas 6 posições
                base.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="libero-rec" className="text-xs">
                  Líbero de receção
                  <span className="ml-1 text-muted-foreground">
                    (adversário serve)
                  </span>
                </Label>
                <Select
                  id="libero-rec"
                  value={liberoReception ?? ""}
                  onChange={(e) =>
                    setLiberoReception(e.target.value || null)
                  }
                >
                  <option value="">— nenhum —</option>
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
                  Líbero de defesa
                  <span className="ml-1 text-muted-foreground">
                    (nós servimos)
                  </span>
                </Label>
                <Select
                  id="libero-def"
                  value={liberoDefense ?? ""}
                  onChange={(e) =>
                    setLiberoDefense(e.target.value || null)
                  }
                >
                  <option value="">— nenhum —</option>
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
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={filled !== 6 || save.isPending}
          >
            {save.isPending ? "A guardar…" : "Guardar lineup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
