import { cn } from "@/lib/utils";

export interface RotationRow {
  rotation: number;
  totalRallies: number;
  serveRallies: number;
  serveWon: number;
  receiveRallies: number;
  receiveWon: number;
  sideOutPct: number;
  breakPointPct: number;
}

/**
 * Tabela de KPIs por rotação. Sideout% (recepção) e Break-point% (serviço)
 * são as duas métricas que mais ditam a performance por rotação no
 * voleibol de elite. Pinta a célula de verde/vermelho conforme o valor
 * está acima/abaixo dos thresholds standard (sideout ≥ 60% verde, < 40%
 * vermelho; break ≥ 35% verde, < 20% vermelho).
 */
export function RotationTable({ rows }: { rows: RotationRow[] }) {
  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left">Rotação</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">SO%</th>
            <th className="px-3 py-2 text-right">SO ratio</th>
            <th className="px-3 py-2 text-right">BP%</th>
            <th className="px-3 py-2 text-right">BP ratio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rotation} className="border-t">
              <td className="px-3 py-2 font-mono">P{r.rotation}</td>
              <td className="px-3 py-2 text-right">{r.totalRallies}</td>
              <td
                className={cn(
                  "px-3 py-2 text-right font-mono",
                  r.receiveRallies === 0
                    ? "text-muted-foreground"
                    : r.sideOutPct >= 60
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : r.sideOutPct < 40
                        ? "text-destructive"
                        : "",
                )}
              >
                {r.receiveRallies ? `${r.sideOutPct}%` : "—"}
              </td>
              <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                {r.receiveRallies
                  ? `${r.receiveWon}/${r.receiveRallies}`
                  : "—"}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-right font-mono",
                  r.serveRallies === 0
                    ? "text-muted-foreground"
                    : r.breakPointPct >= 35
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : r.breakPointPct < 20
                        ? "text-destructive"
                        : "",
                )}
              >
                {r.serveRallies ? `${r.breakPointPct}%` : "—"}
              </td>
              <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                {r.serveRallies ? `${r.serveWon}/${r.serveRallies}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
