import { motion, AnimatePresence } from "framer-motion";
import { ZONES, ZONE_GRID, type Zone } from "@shared/types";
import { cn } from "@/lib/utils";
import type { Player } from "@shared/schema";

/**
 * Campo de voleibol dinâmico. A metade de cima (opponent) mostra as 9 zonas
 * numeradas e aceita toque para escolher a zona de destino da bola. A metade
 * de baixo (nossa) mostra as 6 jogadoras em campo nas suas posições de
 * rotação.
 *
 * Layout (SVG viewBox 300×600, 9 wide × 18 long com ~10% margem):
 *
 *   ┌─────────────┐  ← opponent court
 *   │  4   3   2  │
 *   │  7   8   9  │
 *   │  5   6   1  │
 *   ├━━━━━━━━━━━━━┤  ← net (linha cheia)
 *   │  P4 P3 P2   │  ← nossas jogadoras front row
 *   │             │
 *   │  P5 P6 P1   │  ← nossas jogadoras back row
 *   └─────────────┘
 */

export interface CourtProps {
  /** Zona atualmente selecionada (destaque). */
  selectedZone?: Zone | null;
  /** Callback quando o user toca numa zona do lado adversário. */
  onZoneSelect?: (z: Zone) => void;
  /** Jogadoras em campo, indexadas 0..5 correspondendo às posições 1..6. */
  lineup?: (Player | null)[];
  /** Id da jogadora atualmente selecionada (destaque). */
  selectedPlayerId?: string | null;
  /** Callback quando o user toca num círculo de jogadora. */
  onPlayerSelect?: (id: string) => void;
  /** Rotação actual (1..6). Faz a lineup girar 0..5 slots. */
  rotation?: number;
  /** Quando true, impede toques nas zonas (ex: fluxo ainda não pediu zona). */
  zonesDisabled?: boolean;
  className?: string;
}

// Geometria do SVG
const W = 300;
const H = 600;
const MARGIN = 12;
const COURT_W = W - MARGIN * 2;
const COURT_H = H - MARGIN * 2;
const HALF_H = COURT_H / 2;

// 6 slots de jogador na nossa metade (bottom half) em posições de rotação
// base. Orientação: posição 4 (frente esquerda) → top-left da nossa metade.
//
//   [P4][P3][P2]   ← linha da frente (perto da rede)
//   [P5][P6][P1]   ← linha de trás
const SLOT_POSITIONS: Array<{ row: 0 | 1; col: 0 | 1 | 2; pos: number }> = [
  { row: 0, col: 0, pos: 4 },
  { row: 0, col: 1, pos: 3 },
  { row: 0, col: 2, pos: 2 },
  { row: 1, col: 0, pos: 5 },
  { row: 1, col: 1, pos: 6 },
  { row: 1, col: 2, pos: 1 },
];

export function Court({
  selectedZone,
  onZoneSelect,
  lineup,
  selectedPlayerId,
  onPlayerSelect,
  rotation = 1,
  zonesDisabled,
  className,
}: CourtProps) {
  // Aplica rotação: índice 0 vai para a posição correspondente ao `rotation`.
  const rotatedLineup = lineup
    ? lineup.map((_, i) => {
        const sourceIdx = (i + (rotation - 1)) % 6;
        return lineup[sourceIdx];
      })
    : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("w-full h-auto select-none no-touch-callout", className)}
      aria-label="Campo de voleibol"
    >
      {/* Chão neutro */}
      <rect
        x={0}
        y={0}
        width={W}
        height={H}
        className="fill-muted/30"
      />

      {/* Opponent court */}
      <OpponentHalf
        selectedZone={selectedZone ?? null}
        onZoneSelect={onZoneSelect}
        disabled={!!zonesDisabled}
      />

      {/* Rede */}
      <line
        x1={MARGIN - 4}
        x2={W - MARGIN + 4}
        y1={MARGIN + HALF_H}
        y2={MARGIN + HALF_H}
        stroke="hsl(var(--court-line))"
        strokeWidth={3}
      />
      <text
        x={W / 2}
        y={MARGIN + HALF_H - 6}
        textAnchor="middle"
        className="fill-muted-foreground text-[10px]"
      >
        REDE
      </text>

      {/* Our half */}
      <OurHalf
        lineup={rotatedLineup}
        selectedPlayerId={selectedPlayerId ?? null}
        onPlayerSelect={onPlayerSelect}
      />
    </svg>
  );
}

// ── Opponent half ───────────────────────────────────────────────────────
function OpponentHalf({
  selectedZone,
  onZoneSelect,
  disabled,
}: {
  selectedZone: Zone | null;
  onZoneSelect?: (z: Zone) => void;
  disabled: boolean;
}) {
  const x0 = MARGIN;
  const y0 = MARGIN;
  const cellW = COURT_W / 3;
  const cellH = HALF_H / 3;

  return (
    <g>
      {/* Outline do campo adversário */}
      <rect
        x={x0}
        y={y0}
        width={COURT_W}
        height={HALF_H}
        className="fill-sky-500/5 stroke-[hsl(var(--court-line))]"
        strokeWidth={2}
      />
      {/* Linha de ataque adversária (a 3m da rede) */}
      <line
        x1={x0}
        x2={x0 + COURT_W}
        y1={y0 + HALF_H - cellH}
        y2={y0 + HALF_H - cellH}
        stroke="hsl(var(--court-line))"
        strokeDasharray="4 3"
        strokeOpacity={0.5}
      />
      {/* Label */}
      <text
        x={x0 + 6}
        y={y0 + 14}
        className="fill-muted-foreground text-[10px]"
      >
        ADVERSÁRIO
      </text>

      {ZONES.map((z) => {
        const { col, row } = ZONE_GRID[z];
        const cx = x0 + cellW * col;
        const cy = y0 + cellH * row;
        const isSelected = selectedZone === z;
        return (
          <g key={z}>
            <motion.rect
              x={cx}
              y={cy}
              width={cellW}
              height={cellH}
              rx={6}
              className={cn(
                "transition-colors",
                isSelected
                  ? "fill-primary/25"
                  : disabled
                    ? "fill-muted/10"
                    : "fill-sky-500/10 hover:fill-sky-500/20 cursor-pointer",
              )}
              stroke="hsl(var(--court-line))"
              strokeOpacity={0.35}
              strokeWidth={1}
              onClick={() => !disabled && onZoneSelect?.(z)}
              whileTap={!disabled ? { scale: 0.96 } : undefined}
              style={{ transformOrigin: `${cx + cellW / 2}px ${cy + cellH / 2}px` }}
            />
            <text
              x={cx + cellW / 2}
              y={cy + cellH / 2 + 6}
              textAnchor="middle"
              className={cn(
                "text-[18px] font-bold pointer-events-none",
                isSelected
                  ? "fill-primary"
                  : "fill-foreground/60",
              )}
            >
              {z}
            </text>
            <AnimatePresence>
              {isSelected && (
                <motion.circle
                  cx={cx + cellW / 2}
                  cy={cy + cellH / 2}
                  initial={{ r: 0, opacity: 0.6 }}
                  animate={{ r: Math.min(cellW, cellH) / 2, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  fill="hsl(var(--primary))"
                  pointerEvents="none"
                />
              )}
            </AnimatePresence>
          </g>
        );
      })}
    </g>
  );
}

// ── Our half ────────────────────────────────────────────────────────────
function OurHalf({
  lineup,
  selectedPlayerId,
  onPlayerSelect,
}: {
  lineup: (Player | null)[] | null;
  selectedPlayerId: string | null;
  onPlayerSelect?: (id: string) => void;
}) {
  const x0 = MARGIN;
  const y0 = MARGIN + HALF_H;
  const cellW = COURT_W / 3;
  const cellH = HALF_H / 2;

  return (
    <g>
      <rect
        x={x0}
        y={y0}
        width={COURT_W}
        height={HALF_H}
        className="fill-primary/5 stroke-[hsl(var(--court-line))]"
        strokeWidth={2}
      />
      <line
        x1={x0}
        x2={x0 + COURT_W}
        y1={y0 + cellH}
        y2={y0 + cellH}
        stroke="hsl(var(--court-line))"
        strokeDasharray="4 3"
        strokeOpacity={0.5}
      />
      <text
        x={x0 + 6}
        y={y0 + HALF_H - 6}
        className="fill-muted-foreground text-[10px]"
      >
        NÓS
      </text>

      {SLOT_POSITIONS.map((slot, idx) => {
        const player = lineup?.[idx] ?? null;
        const cx = x0 + cellW * slot.col + cellW / 2;
        const cy = y0 + cellH * slot.row + cellH / 2;
        const isSelected = player && selectedPlayerId === player.id;
        return (
          <g
            key={idx}
            onClick={() => player && onPlayerSelect?.(player.id)}
            className={player ? "cursor-pointer" : "opacity-40"}
          >
            <motion.circle
              cx={cx}
              cy={cy}
              r={28}
              className={cn(
                "stroke-[hsl(var(--court-line))]",
                isSelected ? "fill-primary" : "fill-background",
              )}
              strokeWidth={2}
              whileTap={player ? { scale: 0.92 } : undefined}
              animate={isSelected ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={{ duration: 0.25 }}
            />
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              className={cn(
                "text-[18px] font-bold pointer-events-none",
                isSelected ? "fill-primary-foreground" : "fill-foreground",
              )}
            >
              {player ? `#${player.number}` : "—"}
            </text>
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              className={cn(
                "text-[9px] pointer-events-none",
                isSelected
                  ? "fill-primary-foreground/90"
                  : "fill-muted-foreground",
              )}
            >
              {player ? player.position : `P${slot.pos}`}
            </text>
          </g>
        );
      })}
    </g>
  );
}
