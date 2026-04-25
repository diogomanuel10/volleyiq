import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface SetterTargetRow {
  attackerId: string;
  attackerName: string;
  attackerNumber: number;
  attackerPosition: string;
  count: number;
  kills: number;
}

export interface SetterRow {
  setterId: string;
  setterName: string;
  setterNumber: number;
  totalSets: number;
  targets: SetterTargetRow[];
}

/**
 * Mostra a distribuição de bolas para os atacantes a partir de cada
 * distribuidor que registou pelo menos um `set`. Cada atacante aparece
 * com uma barra horizontal proporcional ao seu peso na distribuição,
 * mais o número de kills convertidos.
 */
export function SetterDistributionCard({ setter }: { setter: SetterRow }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-semibold">
              #{setter.setterNumber} {setter.setterName}
            </div>
            <div className="text-xs text-muted-foreground">Distribuidor</div>
          </div>
          <Badge variant="secondary">{setter.totalSets} bolas</Badge>
        </div>

        <div className="space-y-2">
          {setter.targets.map((t) => {
            const pct = setter.totalSets
              ? Math.round((t.count / setter.totalSets) * 100)
              : 0;
            const killPct = t.count
              ? Math.round((t.kills / t.count) * 100)
              : 0;
            return (
              <div key={t.attackerId} className="space-y-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="truncate">
                    <span className="font-medium">
                      #{t.attackerNumber} {t.attackerName}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      · {t.attackerPosition}
                    </span>
                  </span>
                  <span className="font-mono shrink-0 ml-2">
                    {t.count} ({pct}%) ·{" "}
                    <span
                      className={cn(
                        killPct >= 50
                          ? "text-emerald-600 dark:text-emerald-400"
                          : killPct < 20
                            ? "text-destructive"
                            : "",
                      )}
                    >
                      {t.kills} kills
                    </span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
