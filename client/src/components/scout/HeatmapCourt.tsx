import { ZONES, ZONE_GRID } from "@shared/types";
import { cn } from "@/lib/utils";

/**
 * Court read-only com heatmap por zona. Mostra apenas UMA metade (a metade
 * onde a bola caiu, em função do tipo): ataques/serviços vão para a metade
 * adversária, recepções para a nossa.
 *
 * As cores usam a cor primária com `fill-opacity` proporcional a
 * `count / maxCount`. Zonas vazias ficam quase transparentes.
 */
export interface HeatmapZone {
  zone: number;
  count: number;
  kills?: number;
}

interface Props {
  zones: HeatmapZone[];
  maxCount: number;
  side?: "opponent" | "ours";
  className?: string;
  ariaLabel?: string;
}

export function HeatmapCourt({
  zones,
  maxCount,
  side = "opponent",
  className,
  ariaLabel,
}: Props) {
  const W = 300;
  const H = 200;
  const M = 8;
  const courtW = W - M * 2;
  const courtH = H - M * 2;
  const cellW = courtW / 3;
  const cellH = courtH / 3;
  const baseFill = side === "opponent" ? "fill-sky-500/5" : "fill-primary/5";
  const byZone = new Map<number, HeatmapZone>(zones.map((z) => [z.zone, z]));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("w-full h-auto", className)}
      aria-label={ariaLabel}
    >
      <rect
        x={M}
        y={M}
        width={courtW}
        height={courtH}
        className={cn(baseFill, "stroke-[hsl(var(--court-line))]")}
        strokeWidth={2}
      />

      {ZONES.map((z) => {
        const { col, row } = ZONE_GRID[z];
        const cx = M + cellW * col;
        const cy = M + cellH * row;
        const zone = byZone.get(z);
        const count = zone?.count ?? 0;
        // Escala suave: opacidade mínima 0.05 para zonas com 0; máxima 0.85.
        const intensity =
          maxCount > 0 ? 0.05 + (count / maxCount) * 0.8 : 0.05;
        return (
          <g key={z}>
            <rect
              x={cx}
              y={cy}
              width={cellW}
              height={cellH}
              rx={4}
              fill="hsl(var(--primary))"
              fillOpacity={intensity}
              stroke="hsl(var(--court-line))"
              strokeOpacity={0.3}
              strokeWidth={1}
            />
            <text
              x={cx + cellW / 2}
              y={cy + cellH / 2 - 4}
              textAnchor="middle"
              className="text-[12px] font-bold fill-foreground"
            >
              Z{z}
            </text>
            <text
              x={cx + cellW / 2}
              y={cy + cellH / 2 + 11}
              textAnchor="middle"
              className="text-[14px] font-semibold fill-foreground"
            >
              {count}
            </text>
            {zone?.kills != null && zone.kills > 0 && (
              <text
                x={cx + cellW / 2}
                y={cy + cellH - 4}
                textAnchor="middle"
                className="text-[9px] fill-emerald-600 dark:fill-emerald-400 font-medium"
              >
                {zone.kills} pts
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
