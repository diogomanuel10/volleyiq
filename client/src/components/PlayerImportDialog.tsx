import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadTemplate,
  parseSpreadsheet,
  validateRows,
  type RawRow,
  type ValidationResult,
} from "@/lib/playerImport";
import { api } from "@/lib/api";
import type { Player } from "@shared/schema";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teamId: string;
  existingNumbers: number[];
}

export function PlayerImportDialog({
  open,
  onOpenChange,
  teamId,
  existingNumbers,
}: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RawRow[]>([]);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!result || result.valid.length === 0)
        throw new Error(t("importDialog.player.nothingToImport"));
      return api.post<{ inserted: number; players: Player[] }>(
        "/api/players/bulk",
        {
          teamId,
          players: result.valid.map((v) => v.player),
        },
      );
    },
    onSuccess: (data) => {
      toast.success(t("importDialog.player.imported", { count: data.inserted }));
      qc.invalidateQueries({ queryKey: ["players", teamId] });
      reset();
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error(t("importDialog.player.importError"), {
        description: err instanceof Error ? err.message : String(err),
      }),
  });

  function reset() {
    setRows([]);
    setResult(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setParsing(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const parsed = await parseSpreadsheet(buf);
      setRows(parsed);
      setResult(validateRows(parsed, existingNumbers));
      if (parsed.length === 0) {
        toast.warning(t("importDialog.player.emptyFile"));
      }
    } catch (err) {
      toast.error(t("importDialog.player.readError"), {
        description: err instanceof Error ? err.message : String(err),
      });
      reset();
    } finally {
      setParsing(false);
    }
  }

  const errorsByRow = useMemo(() => {
    const m = new Map<number, string[]>();
    result?.errors.forEach((e) => {
      const list = m.get(e.rowNumber) ?? [];
      list.push(`${e.field}: ${e.message}`);
      m.set(e.rowNumber, list);
    });
    return m;
  }, [result]);

  const warningsByRow = useMemo(() => {
    const m = new Map<number, string[]>();
    result?.warnings.forEach((w) => {
      const list = m.get(w.rowNumber) ?? [];
      list.push(`${w.field}: ${w.message}`);
      m.set(w.rowNumber, list);
    });
    return m;
  }, [result]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("importDialog.player.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("importDialog.player.description")}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadTemplate()}
            >
              <Download className="h-4 w-4" />
              {t("importDialog.player.downloadTemplate")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={parsing || importMutation.isPending}
            >
              <Upload className="h-4 w-4" />
              {t("importDialog.player.chooseFile")}
            </Button>
            {fileName && (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName}
                <button
                  type="button"
                  onClick={reset}
                  className="hover:text-foreground"
                  aria-label={t("importDialog.player.removeFile")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {result && (
            <Summary
              valid={result.valid.length}
              errors={result.errors.length}
              warnings={result.warnings.length}
              total={rows.length}
            />
          )}

          {rows.length > 0 && (
            <div className="rounded-md border overflow-hidden">
              <div className="max-h-[340px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left">#</th>
                      <th className="px-2 py-1.5 text-left">{t("players.dialog.firstName")}</th>
                      <th className="px-2 py-1.5 text-left">{t("players.dialog.lastName")}</th>
                      <th className="px-2 py-1.5 text-left">{t("players.dialog.number")}</th>
                      <th className="px-2 py-1.5 text-left">{t("players.dialog.position")}</th>
                      <th className="px-2 py-1.5 text-left">{t("importDialog.player.height")}</th>
                      <th className="px-2 py-1.5 text-left">{t("importDialog.player.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const errs = errorsByRow.get(r.rowNumber) ?? [];
                      const warns = warningsByRow.get(r.rowNumber) ?? [];
                      const status: "ok" | "warn" | "error" = errs.length
                        ? "error"
                        : warns.length
                          ? "warn"
                          : "ok";
                      return (
                        <tr
                          key={r.rowNumber}
                          className={
                            status === "error"
                              ? "bg-destructive/10"
                              : status === "warn"
                                ? "bg-amber-500/10"
                                : "odd:bg-background even:bg-muted/30"
                          }
                        >
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {r.rowNumber}
                          </td>
                          <td className="px-2 py-1.5">{r.firstName}</td>
                          <td className="px-2 py-1.5">{r.lastName}</td>
                          <td className="px-2 py-1.5">{r.number}</td>
                          <td className="px-2 py-1.5">{r.position}</td>
                          <td className="px-2 py-1.5">{r.heightCm}</td>
                          <td className="px-2 py-1.5 text-xs">
                            {status === "ok" && (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                OK
                              </span>
                            )}
                            {status === "warn" && (
                              <span className="text-amber-600 dark:text-amber-400">
                                {warns.join("; ")}
                              </span>
                            )}
                            {status === "error" && (
                              <span className="text-destructive">
                                {errs.join("; ")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={importMutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => importMutation.mutate()}
            disabled={
              !result ||
              result.valid.length === 0 ||
              importMutation.isPending ||
              parsing
            }
          >
            {importMutation.isPending
              ? t("importDialog.player.importing")
              : result
                ? t("importDialog.player.import", { count: result.valid.length })
                : t("importDialog.player.importDefault")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Summary({
  valid,
  errors,
  warnings,
  total,
}: {
  valid: number;
  errors: number;
  warnings: number;
  total: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <span>
        <b>{total}</b> {t("importDialog.player.rowsRead")}
      </span>
      <span className="text-emerald-600 dark:text-emerald-400">
        <b>{valid}</b> {t("importDialog.player.valid")}
      </span>
      {errors > 0 && (
        <span className="text-destructive">
          <b>{errors}</b> {t("importDialog.player.errors")}
        </span>
      )}
      {warnings > 0 && (
        <span className="text-amber-600 dark:text-amber-400">
          <b>{warnings}</b> {t("importDialog.player.warnings")}
        </span>
      )}
    </div>
  );
}
