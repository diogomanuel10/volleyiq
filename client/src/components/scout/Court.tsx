import { motion, AnimatePresence } from "framer-motion";
import { ZONES, type Zone } from "@shared/types";
import { cn } from "@/lib/utils";
import type { Player } from "@shared/schema";

type Half = "opponent" | "ours";

export interface CourtProps {
  selectedZone?: Zone | null;
  selectedZoneFrom?: Zone | null;
  selectedZoneSide?: Half | null;
  selectedZoneFromSide?: Half | null;
  onZoneSelect?: (z: Zone, side: Half) => void;
  onZoneFromSelect?: (z: Zone, side: Half) => void;
  pickTarget?: "from" | "to" | null;
  lineup?: (Player | null)[];
  selectedPlayerId?: string | null;
  onPlayerSelect?: (id: string) => void;
  rotation?: number;
  playersDisabled?: boolean;
  zonesDisabled?: boolean;
  className?: string;
}

// ── Geometria horizontal ─────────────────────────────────────────────────
const W = 600;
const H = 300;
const MARGIN = 12;
const HALF_W = (W - MARGIN * 2) / 2;
const COURT_H = H - MARGIN * 2;
const CELL_W = HALF_W / 3;
const CELL_H = COURT_H / 3;

// NÓS (direita) — rede à esquerda (col 0)
const ZONE_TO_CELL_OURS: Record<Zone, { col: number; row: number }> = {
  4: { col: 0, row: 0 },
  3: { col: 0, row: 1 },
  2: { col: 0, row: 2 },
  7: { col: 1, row: 0 },
  8: { col: 1, row: 1 },
  9: { col: 1, row: 2 },
  5: { col: 2, row: 0 },
  6: { col: 2, row: 1 },
  1: { col: 2, row: 2 },
};

// ADVERSÁRIO (esquerda) — espelho horizontal, rede à direita (col 2)
const ZONE_TO_CELL_OPP: Record<Zone, { col: number; row: number }> = {
  4: { col: 2, row: 0 },
  3: { col: 2, row: 1 },
  2: { col: 2, row: 2 },
  7: { col: 1, row: 0 },
  8: { col: 1, row: 1 },
  9: { col: 1, row: 2 },
  5: { col: 0, row: 0 },
  6: { col: 0, row: 1 },
  1: { col: 0, row: 2 },
};

// Slots das jogadoras — lado direito (NÓS), rede à esquerda
const SLOT_POSITIONS: Array<{ col: 0 | 1 | 2; row: 0 | 1 | 2; pos: number }> = [
  { col: 0, row: 0, pos: 4 },
  { col: 0, row: 1, pos: 3 },
  { col: 0, row: 2, pos: 2 },
  { col: 2, row: 0, pos: 5 },
  { col: 2, row: 1, pos: 6 },
  { col: 2, row: 2, pos: 1 },
];

function zoneCenter(z: Zone, side: Half) {
  const x0 = side === "opponent" ? MARGIN : MARGIN + HALF_W;
  const map = side === "opponent" ? ZONE_TO_CELL_OPP : ZONE_TO_CELL_OURS;
  const { col, row } = map[z];
  return {
    cx: x0 + CELL_W * col + CELL_W / 2,
    cy: MARGIN + CELL_H * row + CELL_H / 2,
  };
}

export function Court({
  selectedZone,
  selectedZoneFrom,
  selectedZoneSide,
  selectedZoneFromSide,
  onZoneSelect,
  onZoneFromSelect,
  pickTarget,
  lineup,
  selectedPlayerId,
  onPlayerSelect,
  rotation = 1,
  playersDisabled,
  zonesDisabled,
  className,
}: CourtProps) {
  const rotatedLineup = lineup
    ? lineup.map((_, i) => lineup[(i + (rotation - 1)) % 6])
    : null;

  function handleZoneClick(z: Zone, side: Half) {
    if (zonesDisabled) return;
    if (pickTarget === "from") onZoneFromSelect?.(z, side);
    else onZoneSelect?.(z, side);
  }

  const trajectory =
    selectedZoneFrom != null && selectedZoneFromSide &&
    selectedZone != null && selectedZoneSide
      ? {
          from: zoneCenter(selectedZoneFrom, selectedZoneFromSide),
          to: zoneCenter(selectedZone, selectedZoneSide),
        }
      : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("w-full h-auto select-none", className)}
      aria-label="Campo de voleibol"
    >
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="8" refY="5"
          markerWidth="6" markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
        </marker>
      </defs>

      {/* Fundo */}
      <rect x={0} y={0} width={W} height={H} className="fill-muted/30" rx={8} />

      {/* Lado adversário */}
      <ZoneGrid
        side="opponent"
        selectedZone={selectedZone}
        selectedZoneSide={selectedZoneSide}
        selectedZoneFrom={selectedZoneFrom}
        selectedZoneFromSide={selectedZoneFromSide}
        disabled={!!zonesDisabled}
        onZoneClick={handleZoneClick}
      />

      {/* Rede vertical */}
      <line
        x1={MARGIN + HALF_W} x2={MARGIN + HALF_W}
        y1={MARGIN - 4} y2={H - MARGIN + 4}
        stroke="hsl(var(--court-line))"
        strokeWidth={4}
      />
      <text
        x={MARGIN + HALF_W}
        y={H / 2 + 4}
        textAnchor="middle"
        className="fill-muted-foreground text-[9px]"
        transform={`rotate(-90, ${MARGIN + HALF_W}, ${H / 2})`}
      >
        REDE
      </text>

      {/* Lado nosso */}
      <ZoneGrid
        side="ours"
        selectedZone={selectedZone}
        selectedZoneSide={selectedZoneSide}
        selectedZoneFrom={selectedZoneFrom}
        selectedZoneFromSide={selectedZoneFromSide}
        disabled={!!zonesDisabled}
        onZoneClick={handleZoneClick}
      />

      {/* Jogadoras */}
      <OurPlayers
        lineup={rotatedLineup}
        selectedPlayerId={selectedPlayerId ?? null}
        onPlayerSelect={onPlayerSelect}
        disabled={!!playersDisabled}
      />

      {/* Seta de trajectória */}
      {trajectory && (
        <TrajectoryArrow from={trajectory.from} to={trajectory.to} />
      )}
    </svg>
  );
}

// ── Zone grid ────────────────────────────────────────────────────────────
function ZoneGrid({
  side,
  selectedZone,
  selectedZoneSide,
  selectedZoneFrom,
  selectedZoneFromSide,
  disabled,
  onZoneClick,
}: {
  side: Half;
  selectedZone?: Zone | null;
  selectedZoneSide?: Half | null;
  selectedZoneFrom?: Zone | null;
  selectedZoneFromSide?: Half | null;
  disabled: boolean;
  onZoneClick: (z: Zone, side: Half) => void;
}) {
  const x0 = side === "opponent" ? MARGIN : MARGIN + HALF_W;
  const y0 = MARGIN;
  const map = side === "opponent" ? ZONE_TO_CELL_OPP : ZONE_TO_CELL_OURS;

  return (
    <g>
      {/* Outline */}
      <rect
        x={x0} y={y0}
        width={HALF_W} height={COURT_H}
        className={cn(
          side === "opponent" ? "fill-sky-500/5" : "fill-primary/5",
          "stroke-[hsl(var(--court-line))]",
        )}
        strokeWidth={2}
      />
      {/* Linha de ataque */}
      <line
        x1={side === "opponent" ? x0 + HALF_W - CELL_W : x0 + CELL_W}
        x2={side === "opponent" ? x0 + HALF_W - CELL_W : x0 + CELL_W}
        y1={y0} y2={y0 + COURT_H}
        stroke="hsl(var(--court-line))"
        strokeDasharray="4 3"
        strokeOpacity={0.5}
      />
      {/* Label */}
      <text
        x={side === "opponent" ? x0 + 8 : x0 + HALF_W - 8}
        y={y0 + 14}
        textAnchor={side === "opponent" ? "start" : "end"}
        className="fill-muted-foreground text-[10px]"
      >
        {side === "opponent" ? "ADVERSÁRIO" : "NÓS"}
      </text>

      {ZONES.map((z) => {
        const { col, row } = map[z];
        const cx = x0 + CELL_W * col;
        const cy = y0 + CELL_H * row;
        const isTo = selectedZone === z && selectedZoneSide === side;
        const isFrom = selectedZoneFrom === z && selectedZoneFromSide === side;

        return (
          <g key={`${side}-${z}`}>
            <motion.rect
              x={cx} y={cy}
              width={CELL_W} height={CELL_H}
              rx={4}
              className={cn(
                isTo ? "fill-primary/25"
                  : isFrom ? "fill-amber-500/30"
                  : disabled
                    ? side === "opponent" ? "fill-sky-500/5" : "fill-primary/5"
                    : side === "opponent"
                      ? "fill-sky-500/10 hover:fill-sky-500/20 cursor-pointer"
                      : "fill-primary/10 hover:fill-primary/20 cursor-pointer",
              )}
              stroke="hsl(var(--court-line))"
              strokeOpacity={0.35}
              strokeWidth={1}
              onClick={() => !disabled && onZoneClick(z, side)}
              whileTap={!disabled ? { scale: 0.96 } : undefined}
              style={{ transformOrigin: `${cx + CELL_W / 2}px ${cy + CELL_H / 2}px` }}
            />
            <text
              x={cx + CELL_W / 2}
              y={cy + CELL_H / 2 + 6}
              textAnchor="middle"
              className={cn(
                "text-[18px] font-bold pointer-events-none",
                isTo ? "fill-primary"
                  : isFrom ? "fill-amber-600"
                  : "fill-foreground/50",
              )}
            >
              {z}
            </text>
            <AnimatePresence>
              {(isTo || isFrom) && (
                <motion.circle
                  cx={cx + CELL_W / 2}
                  cy={cy + CELL_H / 2}
                  initial={{ r: 0, opacity: 0.6 }}
                  animate={{ r: Math.min(CELL_W, CELL_H) / 2, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  fill={isTo ? "hsl(var(--primary))" : "rgb(245 158 11)"}
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

// ── Seta de trajectória ──────────────────────────────────────────────────
function TrajectoryArrow({
  from,
  to,
}: {
  from: { cx: number; cy: number };
  to: { cx: number; cy: number };
}) {
  const mx = (from.cx + to.cx) / 2;
  const my = (from.cy + to.cy) / 2;
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = Math.min(len * 0.25, 40);

  return (
    <motion.path
      d={`M ${from.cx} ${from.cy} Q ${mx + nx * bend} ${my + ny * bend}, ${to.cx} ${to.cy}`}
      fill="none"
      stroke="hsl(var(--primary))"
      strokeWidth={3}
      strokeLinecap="round"
      markerEnd="url(#arrowhead)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    />
  );
}

// ── Our players ──────────────────────────────────────────────────────────
function OurPlayers({
  lineup,
  selectedPlayerId,
  onPlayerSelect,
  disabled,
}: {
  lineup: (Player | null)[] | null;
  selectedPlayerId: string | null;
  onPlayerSelect?: (id: string) => void;
  disabled: boolean;
}) {
  const x0 = MARGIN + HALF_W;
  const y0 = MARGIN;

  return (
    <g>
      {SLOT_POSITIONS.map((slot, idx) => {
        const player = lineup?.[idx] ?? null;
        const cx = x0 + CELL_W * slot.col + CELL_W / 2;
        const cy = y0 + CELL_H * slot.row + CELL_H / 2;
        const isSelected = !!(player && selectedPlayerId === player.id);
        const clickable = !disabled && !!player;

        return (
          <g
            key={idx}
            onClick={() => clickable && onPlayerSelect?.(player!.id)}
            className={cn(
              clickable ? "cursor-pointer" : "",
              !player && "opacity-40",
              disabled && "pointer-events-none",
            )}
            style={disabled ? { opacity: 0.65 } : undefined}
          >
            <motion.circle
              cx={cx} cy={cy} r={22}
              className={cn(
                "stroke-[hsl(var(--court-line))]",
                isSelected ? "fill-primary" : "fill-background",
              )}
              strokeWidth={2}
              whileTap={clickable ? { scale: 0.92 } : undefined}
              animate={isSelected ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={{ duration: 0.25 }}
            />
            <text
              x={cx} y={cy - 4}
              textAnchor="middle"
              className={cn(
                "text-[13px] font-bold pointer-events-none",
                isSelected ? "fill-primary-foreground" : "fill-foreground",
              )}
            >
              {player ? `#${player.number}` : "—"}
            </text>
            <text
              x={cx} y={cy + 9}
              textAnchor="middle"
              className={cn(
                "text-[8px] pointer-events-none",
                isSelected ? "fill-primary-foreground/90" : "fill-muted-foreground",
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