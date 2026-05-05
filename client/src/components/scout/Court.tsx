import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZONES, type Zone } from "@shared/types";
import { cn } from "@/lib/utils";
import type { Player } from "@shared/schema";

type Half = "opponent" | "ours";

/** Ponto SVG (em coordenadas do viewBox) de onde a bola caiu. */
export interface CourtPoint {
  x: number;
  y: number;
  side: Half;
}

export interface CourtProps {
  selectedZone?: Zone | null;
  selectedZoneFrom?: Zone | null;
  selectedZoneSide?: Half | null;
  selectedZoneFromSide?: Half | null;
  /** Posição precisa onde o utilizador tocou (origem). */
  selectedPointFrom?: CourtPoint | null;
  /** Posição precisa onde a bola caiu (destino). */
  selectedPointTo?: CourtPoint | null;
  onZoneSelect?: (z: Zone, side: Half, point: CourtPoint) => void;
  onZoneFromSelect?: (z: Zone, side: Half, point: CourtPoint) => void;
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
  2: { col: 0, row: 0 },
  3: { col: 0, row: 1 },
  4: { col: 0, row: 2 },
  9: { col: 1, row: 0 },
  8: { col: 1, row: 1 },
  7: { col: 1, row: 2 },
  1: { col: 2, row: 0 },
  6: { col: 2, row: 1 },
  5: { col: 2, row: 2 },
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

// Inversos pré-computados: (col,row) → zone
const CELL_TO_ZONE_OURS = invertMap(ZONE_TO_CELL_OURS);
const CELL_TO_ZONE_OPP = invertMap(ZONE_TO_CELL_OPP);

function invertMap(map: Record<Zone, { col: number; row: number }>) {
  const out: Record<string, Zone> = {};
  for (const [zStr, { col, row }] of Object.entries(map)) {
    out[`${col}-${row}`] = Number(zStr) as Zone;
  }
  return out;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Converte um ponto SVG dentro de um meio-campo na zona DataVolley. */
function pointToZone(x: number, y: number, side: Half): Zone {
  const x0 = side === "opponent" ? MARGIN : MARGIN + HALF_W;
  const y0 = MARGIN;
  const col = clamp(Math.floor((x - x0) / CELL_W), 0, 2);
  const row = clamp(Math.floor((y - y0) / CELL_H), 0, 2);
  const map = side === "opponent" ? CELL_TO_ZONE_OPP : CELL_TO_ZONE_OURS;
  return map[`${col}-${row}`];
}

function zoneCenter(z: Zone, side: Half) {
  const x0 = side === "opponent" ? MARGIN : MARGIN + HALF_W;
  const map = side === "opponent" ? ZONE_TO_CELL_OPP : ZONE_TO_CELL_OURS;
  const { col, row } = map[z];
  return {
    cx: x0 + CELL_W * col + CELL_W / 2,
    cy: MARGIN + CELL_H * row + CELL_H / 2,
  };
}

/**
 * Devolve a posição central de uma zona como `CourtPoint`. Útil para fallback
 * quando o utilizador escolhe a zona por teclado (sem coordenadas precisas).
 */
export function zoneToPoint(z: Zone, side: Half): CourtPoint {
  const { cx, cy } = zoneCenter(z, side);
  return { x: cx, y: cy, side };
}

// Lado direito (NÓS), rede à esquerda
// row 0 = linha de rede, row 2 = linha de fundo
// A linha do meio (row 1) não tem jogadoras — só é usada para zonas de stats
const SLOT_POSITIONS: Array<{ col: 0 | 1 | 2; row: 0 | 1 | 2; pos: number }> = [
  { col: 2, row: 0, pos: 1 }, // Posição 1 — rede direita (espelho pos 2 adversário)
  { col: 0, row: 0, pos: 2 }, // Posição 2 — rede esquerda (junto à rede central)
  { col: 0, row: 1, pos: 3 }, // Posição 3 — meio esquerda
  { col: 2, row: 1, pos: 6 }, // Posição 6 — meio direita
  { col: 0, row: 2, pos: 4 }, // Posição 4 — fundo esquerda
  { col: 2, row: 2, pos: 5 }, // Posição 5 — fundo direita (espelho pos 4 adversário)
];

export function Court({
  selectedZone,
  selectedZoneFrom,
  selectedZoneSide,
  selectedZoneFromSide,
  selectedPointFrom,
  selectedPointTo,
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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rotatedLineup = lineup
    ? SLOT_POSITIONS.map((slot) =>
        lineup[(slot.pos - rotation + 6) % 6] ?? null,
      )
    : null;

  function handleHalfClick(e: React.MouseEvent<SVGRectElement>, side: Half) {
    if (zonesDisabled) return;
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(ctm.inverse());
    const z = pointToZone(local.x, local.y, side);
    if (!z) return;
    const point: CourtPoint = { x: local.x, y: local.y, side };
    if (pickTarget === "from") onZoneFromSelect?.(z, side, point);
    else onZoneSelect?.(z, side, point);
  }

  // Pontos a desenhar — preferimos as coords precisas se existirem; senão
  // caímos no centro da zona seleccionada (compatibilidade com selecção
  // por teclado ou estados antigos).
  const fromPoint =
    selectedPointFrom ??
    (selectedZoneFrom != null && selectedZoneFromSide
      ? zoneToPoint(selectedZoneFrom, selectedZoneFromSide)
      : null);
  const toPoint =
    selectedPointTo ??
    (selectedZone != null && selectedZoneSide
      ? zoneToPoint(selectedZone, selectedZoneSide)
      : null);

  const trajectory =
    fromPoint && toPoint
      ? {
          from: { cx: fromPoint.x, cy: fromPoint.y },
          to: { cx: toPoint.x, cy: toPoint.y },
        }
      : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={cn("w-full h-auto select-none", className)}
      aria-label="Campo de voleibol"
    >
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
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
        onHalfClick={handleHalfClick}
      />

      {/* Rede — duas linhas paralelas evocando a malha, com vinheta central */}
      <g pointerEvents="none">
        <line
          x1={MARGIN + HALF_W - 2}
          x2={MARGIN + HALF_W - 2}
          y1={MARGIN - 6}
          y2={H - MARGIN + 6}
          stroke="hsl(var(--court-line))"
          strokeWidth={2}
          strokeOpacity={0.7}
        />
        <line
          x1={MARGIN + HALF_W + 2}
          x2={MARGIN + HALF_W + 2}
          y1={MARGIN - 6}
          y2={H - MARGIN + 6}
          stroke="hsl(var(--court-line))"
          strokeWidth={2}
          strokeOpacity={0.7}
        />
        <line
          x1={MARGIN + HALF_W}
          x2={MARGIN + HALF_W}
          y1={MARGIN - 6}
          y2={H - MARGIN + 6}
          stroke="hsl(var(--court-line))"
          strokeWidth={1}
          strokeDasharray="2 3"
          strokeOpacity={0.5}
        />
      </g>
      <text
        x={MARGIN + HALF_W}
        y={H / 2 + 4}
        textAnchor="middle"
        className="fill-muted-foreground text-[9px] font-semibold tracking-widest"
        transform={`rotate(-90, ${MARGIN + HALF_W}, ${H / 2})`}
        pointerEvents="none"
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
        onHalfClick={handleHalfClick}
      />

      {/* Jogadoras */}
      <OurPlayers
        lineup={rotatedLineup}
        selectedPlayerId={selectedPlayerId ?? null}
        onPlayerSelect={onPlayerSelect}
        disabled={!!playersDisabled}
      />

      {/* Marcadores precisos (origem + destino) */}
      <AnimatePresence>
        {fromPoint && (
          <PointMarker
            key="from"
            cx={fromPoint.x}
            cy={fromPoint.y}
            color="amber"
          />
        )}
        {toPoint && (
          <PointMarker
            key="to"
            cx={toPoint.x}
            cy={toPoint.y}
            color="primary"
          />
        )}
      </AnimatePresence>

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
  onHalfClick,
}: {
  side: Half;
  selectedZone?: Zone | null;
  selectedZoneSide?: Half | null;
  selectedZoneFrom?: Zone | null;
  selectedZoneFromSide?: Half | null;
  disabled: boolean;
  onHalfClick: (e: React.MouseEvent<SVGRectElement>, side: Half) => void;
}) {
  const x0 = side === "opponent" ? MARGIN : MARGIN + HALF_W;
  const y0 = MARGIN;
  const map = side === "opponent" ? ZONE_TO_CELL_OPP : ZONE_TO_CELL_OURS;

  return (
    <g>
      {/* Linhas internas de zona (decorativas) */}
      {ZONES.map((z) => {
        const { col, row } = map[z];
        const cx = x0 + CELL_W * col;
        const cy = y0 + CELL_H * row;
        const isTo = selectedZone === z && selectedZoneSide === side;
        const isFrom = selectedZoneFrom === z && selectedZoneFromSide === side;
        return (
          <g key={`${side}-${z}`} pointerEvents="none">
            <motion.rect
              x={cx}
              y={cy}
              width={CELL_W}
              height={CELL_H}
              rx={4}
              className={cn(
                isTo
                  ? "fill-primary/20"
                  : isFrom
                    ? "fill-amber-500/25"
                    : "fill-transparent",
              )}
              stroke="hsl(var(--court-line))"
              strokeOpacity={0.25}
              strokeWidth={1}
            />
            <text
              x={cx + CELL_W / 2}
              y={cy + CELL_H / 2 + 6}
              textAnchor="middle"
              className={cn(
                "font-bold pointer-events-none transition-all",
                isTo
                  ? "text-[18px] fill-primary"
                  : isFrom
                    ? "text-[18px] fill-amber-600"
                    : disabled
                      ? "text-[12px] fill-foreground/20"
                      : "text-[14px] fill-foreground/35",
              )}
            >
              {z}
            </text>
          </g>
        );
      })}

      {/* Outline + área clicável (única — toda a metade reage ao toque) */}
      <rect
        x={x0}
        y={y0}
        width={HALF_W}
        height={COURT_H}
        rx={2}
        className={cn(
          side === "opponent"
            ? "fill-sky-500/[0.06]"
            : "fill-primary/[0.06]",
          "stroke-[hsl(var(--court-line))]",
          !disabled &&
            (side === "opponent"
              ? "hover:fill-sky-500/15 cursor-crosshair"
              : "hover:fill-primary/15 cursor-crosshair"),
          disabled && "pointer-events-none",
        )}
        strokeWidth={2}
        onClick={(e) => onHalfClick(e, side)}
      />

      {/* Linha de ataque */}
      <line
        x1={side === "opponent" ? x0 + HALF_W - CELL_W : x0 + CELL_W}
        x2={side === "opponent" ? x0 + HALF_W - CELL_W : x0 + CELL_W}
        y1={y0}
        y2={y0 + COURT_H}
        stroke="hsl(var(--court-line))"
        strokeDasharray="4 3"
        strokeOpacity={0.5}
        pointerEvents="none"
      />

      {/* Label */}
      <text
        x={side === "opponent" ? x0 + 8 : x0 + HALF_W - 8}
        y={y0 + 14}
        textAnchor={side === "opponent" ? "start" : "end"}
        className="fill-muted-foreground text-[10px]"
        pointerEvents="none"
      >
        {side === "opponent" ? "ADVERSÁRIO" : "NÓS"}
      </text>
    </g>
  );
}

// ── Marcador de ponto preciso ────────────────────────────────────────────
function PointMarker({
  cx,
  cy,
  color,
}: {
  cx: number;
  cy: number;
  color: "primary" | "amber";
}) {
  const fill =
    color === "primary" ? "hsl(var(--primary))" : "rgb(245 158 11)";
  return (
    <g pointerEvents="none">
      <motion.circle
        cx={cx}
        cy={cy}
        initial={{ r: 0, opacity: 0.7 }}
        animate={{ r: 18, opacity: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        fill={fill}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={6}
        fill={fill}
        stroke="white"
        strokeWidth={2}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      />
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
      pointerEvents="none"
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
            onClick={(e) => {
              if (!clickable) return;
              e.stopPropagation();
              onPlayerSelect?.(player!.id);
            }}
            className={cn(
              clickable ? "cursor-pointer" : "",
              !player && "opacity-40",
              disabled && "pointer-events-none",
            )}
            style={disabled ? { opacity: 0.65 } : undefined}
          >
            <motion.circle
              cx={cx}
              cy={cy}
              r={22}
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
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              className={cn(
                "text-[13px] font-bold pointer-events-none",
                isSelected ? "fill-primary-foreground" : "fill-foreground",
              )}
            >
              {player ? `#${player.number}` : "—"}
            </text>
            <text
              x={cx}
              y={cy + 9}
              textAnchor="middle"
              className={cn(
                "text-[8px] pointer-events-none",
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
