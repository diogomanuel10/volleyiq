import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Users,
  Type,
  Square,
  Circle,
  Minus,
  Copy,
  Printer,
  Undo2,
  Camera,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import { api } from "@/lib/api";
import { getLastKnownToken } from "@/lib/firebase";
import { useTeam } from "@/hooks/useTeam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Board, Player } from "@shared/schema";
import {
  CANVAS_W,
  CANVAS_H,
  type BoardSlideData,
  type BoardElement,
  type PlayerBoardElement,
  type TextBoardElement,
  type ShapeBoardElement,
  type ArrowBoardElement,
} from "@shared/boardTypes";

// ─── Volleyball court SVG background ─────────────────────────────────────────

function CourtBg({ half, color }: { half?: boolean; color: string }) {
  const courtW = half ? CANVAS_W : CANVAS_W;
  const courtH = CANVAS_H;
  const lineColor = "rgba(255,255,255,0.7)";
  return (
    <svg
      viewBox={`0 0 ${courtW} ${courtH}`}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    >
      {/* Floor */}
      <rect width={courtW} height={courtH} fill="#c8a96a" />
      {/* Court boundary */}
      {!half ? (
        <>
          <rect x="60" y="80" width={courtW - 120} height={courtH - 160} fill="none" stroke={lineColor} strokeWidth="3" />
          {/* Net */}
          <line x1={courtW / 2} y1="60" x2={courtW / 2} y2={courtH - 60} stroke="white" strokeWidth="5" />
          {/* Attack lines */}
          <line x1={courtW / 2 - 220} y1="80" x2={courtW / 2 - 220} y2={courtH - 80} stroke={lineColor} strokeWidth="2" strokeDasharray="8 4" />
          <line x1={courtW / 2 + 220} y1="80" x2={courtW / 2 + 220} y2={courtH - 80} stroke={lineColor} strokeWidth="2" strokeDasharray="8 4" />
          {/* Zone numbers */}
          {([
            [160, 200, "6"], [160, 430, "5"], [160, 620, "4"],
            [480, 200, "1"], [480, 430, "2"], [480, 620, "3"],
          ] as [number, number, string][]).map(([x, y, n]) => (
            <text key={n} x={x} y={y} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="36" fontFamily="sans-serif">{n}</text>
          ))}
        </>
      ) : (
        <>
          <rect x="60" y="80" width={(courtW - 120) / 2} height={courtH - 160} fill="none" stroke={lineColor} strokeWidth="3" />
          <line x1="60" y1="80" x2={courtW / 2} y2="80" stroke={lineColor} strokeWidth="5" />
          <line x1={courtW / 2 - 220} y1="80" x2={courtW / 2 - 220} y2={courtH - 80} stroke={lineColor} strokeWidth="2" strokeDasharray="8 4" />
          {([
            [160, 200, "6"], [160, 430, "5"], [160, 620, "4"],
            [480, 200, "1"], [480, 430, "2"], [480, 620, "3"],
          ] as [number, number, string][]).map(([x, y, n]) => (
            <text key={n} x={x} y={y} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="36" fontFamily="sans-serif">{n}</text>
          ))}
        </>
      )}
    </svg>
  );
}

// ─── Element rendering ────────────────────────────────────────────────────────

function PlayerCard({
  element,
  player,
  selected,
  scale,
  onPointerDown,
  onDoubleClick,
}: {
  element: PlayerBoardElement;
  player: Player | undefined;
  selected: boolean;
  scale: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
}) {
  const initials = player
    ? `${player.firstName[0]}${player.lastName[0]}`
    : "?";
  const displayName = element.showName
    ? player
      ? `${player.firstName} ${player.lastName}`
      : "Jogador"
    : "";

  return (
    <div
      className={`absolute cursor-move select-none rounded-xl overflow-hidden flex flex-col items-center justify-center gap-1 shadow-lg transition-shadow ${
        selected ? "ring-2 ring-white ring-offset-1 ring-offset-transparent shadow-xl" : ""
      }`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        background: element.cardColor ?? "#1e40af",
        zIndex: element.zIndex,
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {/* Photo / Avatar */}
      {element.showPhoto && (
        <div
          className="rounded-full overflow-hidden flex items-center justify-center bg-white/20 text-white font-bold"
          style={{ width: element.height * 0.42, height: element.height * 0.42, fontSize: element.height * 0.18 }}
        >
          {player?.photoUrl ? (
            <img src={player.photoUrl} alt={initials} className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
      )}
      {/* Number badge */}
      {element.showNumber && player?.number !== undefined && (
        <span
          className="font-black text-white/90 leading-none"
          style={{ fontSize: element.height * 0.2 }}
        >
          #{player.number}
        </span>
      )}
      {/* Name */}
      {element.showName && displayName && (
        <span
          className="text-white font-medium leading-tight text-center px-1 truncate w-full"
          style={{ fontSize: element.height * 0.13 }}
        >
          {displayName}
        </span>
      )}
      {/* Position */}
      {element.showPosition && player?.position && (
        <span
          className="bg-white/20 text-white/80 rounded px-1"
          style={{ fontSize: element.height * 0.11 }}
        >
          {player.position}
        </span>
      )}
      {selected && (
        <div className="absolute inset-0 border-2 border-white/40 rounded-xl pointer-events-none" />
      )}
    </div>
  );
}

function TextBox({
  element,
  selected,
  editing,
  onPointerDown,
  onDoubleClick,
  onContentChange,
}: {
  element: TextBoardElement;
  selected: boolean;
  editing: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
  onContentChange: (val: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  }, [editing]);

  return (
    <div
      className={`absolute cursor-move select-none ${selected ? "outline outline-2 outline-white" : ""}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        background: element.background ?? "transparent",
        borderRadius: 4,
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <div
        ref={ref}
        contentEditable={editing}
        suppressContentEditableWarning
        onInput={(e) => onContentChange((e.target as HTMLElement).innerText)}
        onPointerDown={editing ? (e) => e.stopPropagation() : undefined}
        className={`w-full h-full overflow-hidden break-words ${editing ? "cursor-text outline-none" : ""}`}
        style={{
          fontSize: element.fontSize,
          color: element.color,
          fontWeight: element.bold ? "bold" : "normal",
          fontStyle: element.italic ? "italic" : "normal",
          textAlign: element.align,
          padding: 8,
          lineHeight: 1.4,
        }}
      >
        {element.content}
      </div>
    </div>
  );
}

function ShapeEl({
  element,
  selected,
  onPointerDown,
}: {
  element: ShapeBoardElement;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const isCircle = element.shape === "circle";
  return (
    <div
      className={`absolute cursor-move ${selected ? "outline outline-2 outline-white" : ""}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        background: element.fill,
        border: `${element.strokeWidth}px solid ${element.stroke}`,
        borderRadius: isCircle ? "50%" : 4,
        opacity: element.opacity,
      }}
      onPointerDown={onPointerDown}
    />
  );
}

function ArrowEl({
  element,
  selected,
  onPointerDown,
}: {
  element: ArrowBoardElement;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const dx = element.x2 - element.x;
  const dy = element.y2 - element.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const bboxW = Math.abs(dx) + 40;
  const bboxH = Math.abs(dy) + 40;
  const ox = element.x < element.x2 ? 0 : Math.abs(dx);
  const oy = element.y < element.y2 ? 0 : Math.abs(dy);
  const id = `arrow-${element.id}`;
  return (
    <div
      className={`absolute cursor-move ${selected ? "outline outline-1 outline-white" : ""}`}
      style={{
        left: Math.min(element.x, element.x2) - 20,
        top: Math.min(element.y, element.y2) - 20,
        width: bboxW,
        height: bboxH,
        zIndex: element.zIndex,
        pointerEvents: "all",
      }}
      onPointerDown={onPointerDown}
    >
      <svg width={bboxW} height={bboxH} style={{ overflow: "visible" }}>
        <defs>
          <marker id={id} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={element.color} />
          </marker>
        </defs>
        <line
          x1={ox + 20}
          y1={oy + 20}
          x2={ox + 20 + dx}
          y2={oy + 20 + dy}
          stroke={element.color}
          strokeWidth={element.strokeWidth}
          strokeDasharray={element.dashed ? "12 6" : undefined}
          markerEnd={`url(#${id})`}
        />
      </svg>
    </div>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

interface DragState {
  elementId: string;
  startMouseX: number;
  startMouseY: number;
  startElemX: number;
  startElemY: number;
  // For arrows, track both endpoints
  startX2?: number;
  startY2?: number;
}

function BoardCanvas({
  slide,
  players,
  selectedId,
  editingTextId,
  scale,
  onSelect,
  onDeselect,
  onMoveElement,
  onTextChange,
  onStartEditText,
}: {
  slide: BoardSlideData;
  players: Player[];
  selectedId: string | null;
  editingTextId: string | null;
  scale: number;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onMoveElement: (id: string, x: number, y: number) => void;
  onTextChange: (id: string, val: string) => void;
  onStartEditText: (id: string) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const isCourtBg = slide.background === "court" || slide.background === "half-court";
  const bgStyle = isCourtBg ? undefined : { background: slide.background };

  const sortedElements = useMemo(
    () => [...slide.elements].sort((a, b) => a.zIndex - b.zIndex),
    [slide.elements],
  );

  function handleElementPointerDown(e: React.PointerEvent, element: BoardElement) {
    if (editingTextId === element.id) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSelect(element.id);
    setDrag({
      elementId: element.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startElemX: element.x,
      startElemY: element.y,
      startX2: (element as ArrowBoardElement).x2,
      startY2: (element as ArrowBoardElement).y2,
    });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const dx = (e.clientX - drag.startMouseX) / scale;
    const dy = (e.clientY - drag.startMouseY) / scale;
    onMoveElement(drag.elementId, drag.startElemX + dx, drag.startElemY + dy);
  }

  function handlePointerUp() {
    setDrag(null);
  }

  return (
    <div
      ref={canvasRef}
      className="relative overflow-hidden rounded-sm shadow-2xl board-print-canvas"
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        transformOrigin: "top left",
        transform: `scale(${scale})`,
        ...bgStyle,
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={onDeselect}
    >
      {/* Background */}
      {isCourtBg && (
        <CourtBg
          half={slide.background === "half-court"}
          color="#2563eb"
        />
      )}

      {/* Elements */}
      {sortedElements.map((el) => {
        const pDown = (e: React.PointerEvent) =>
          handleElementPointerDown(e, el);

        if (el.type === "player") {
          const player = players.find((p) => p.id === el.playerId);
          return (
            <PlayerCard
              key={el.id}
              element={el}
              player={player}
              selected={selectedId === el.id}
              scale={scale}
              onPointerDown={pDown}
              onDoubleClick={() => {}}
            />
          );
        }
        if (el.type === "text") {
          return (
            <TextBox
              key={el.id}
              element={el}
              selected={selectedId === el.id}
              editing={editingTextId === el.id}
              onPointerDown={pDown}
              onDoubleClick={() => onStartEditText(el.id)}
              onContentChange={(v) => onTextChange(el.id, v)}
            />
          );
        }
        if (el.type === "shape") {
          return (
            <ShapeEl
              key={el.id}
              element={el}
              selected={selectedId === el.id}
              onPointerDown={pDown}
            />
          );
        }
        if (el.type === "arrow") {
          return (
            <ArrowEl
              key={el.id}
              element={el}
              selected={selectedId === el.id}
              onPointerDown={pDown}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function PropertiesPanel({
  element,
  players,
  onUpdate,
  onDelete,
  onDuplicate,
  teamColor,
}: {
  element: BoardElement | null;
  players: Player[];
  onUpdate: (patch: Partial<BoardElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  teamColor?: string;
}) {
  if (!element)
    return (
      <div className="w-56 shrink-0 border-l p-4 hidden lg:block">
        <p className="text-xs text-muted-foreground">
          Seleciona um elemento para editar as propriedades.
        </p>
      </div>
    );

  return (
    <div className="w-56 shrink-0 border-l p-3 overflow-y-auto hidden lg:flex lg:flex-col gap-3">
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={onDuplicate}>
          <Copy className="h-3 w-3 mr-1" /> Duplicar
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {element.type === "player" && (
        <>
          <div>
            <Label className="text-xs">Cor do card</Label>
            <input
              type="color"
              value={element.cardColor ?? teamColor ?? "#1e40af"}
              onChange={(e) => onUpdate({ cardColor: e.target.value } as any)}
              className="mt-1 h-8 w-full rounded border cursor-pointer"
            />
          </div>
          <div className="space-y-1.5">
            {(
              [
                ["showPhoto", "Mostrar foto"],
                ["showNumber", "Mostrar número"],
                ["showName", "Mostrar nome"],
                ["showPosition", "Mostrar posição"],
              ] as [keyof PlayerBoardElement, string][]
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!(element as any)[key]}
                  onChange={(e) => onUpdate({ [key]: e.target.checked } as any)}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
        </>
      )}

      {element.type === "text" && (
        <>
          <div>
            <Label className="text-xs">Tamanho de letra</Label>
            <input
              type="range"
              min={12}
              max={120}
              value={element.fontSize}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) } as any)}
              className="w-full mt-1"
            />
            <span className="text-xs text-muted-foreground">{element.fontSize}px</span>
          </div>
          <div>
            <Label className="text-xs">Cor do texto</Label>
            <input
              type="color"
              value={element.color}
              onChange={(e) => onUpdate({ color: e.target.value } as any)}
              className="mt-1 h-8 w-full rounded border cursor-pointer"
            />
          </div>
          <div>
            <Label className="text-xs">Fundo</Label>
            <input
              type="color"
              value={element.background ?? "#000000"}
              onChange={(e) => onUpdate({ background: e.target.value } as any)}
              className="mt-1 h-8 w-full rounded border cursor-pointer"
            />
            <button
              className="text-xs text-muted-foreground mt-1"
              onClick={() => onUpdate({ background: undefined } as any)}
            >
              Sem fundo
            </button>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant={element.bold ? "default" : "outline"}
              className="flex-1 text-xs font-bold"
              onClick={() => onUpdate({ bold: !element.bold } as any)}
            >
              B
            </Button>
            <Button
              size="sm"
              variant={element.italic ? "default" : "outline"}
              className="flex-1 text-xs italic"
              onClick={() => onUpdate({ italic: !element.italic } as any)}
            >
              I
            </Button>
          </div>
          <div>
            <Label className="text-xs">Alinhamento</Label>
            <div className="flex gap-1 mt-1">
              {(["left", "center", "right"] as const).map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant={element.align === a ? "default" : "outline"}
                  className="flex-1 text-xs"
                  onClick={() => onUpdate({ align: a } as any)}
                >
                  {a === "left" ? "≡" : a === "center" ? "≡" : "≡"}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}

      {element.type === "shape" && (
        <>
          <div>
            <Label className="text-xs">Preenchimento</Label>
            <input
              type="color"
              value={element.fill}
              onChange={(e) => onUpdate({ fill: e.target.value } as any)}
              className="mt-1 h-8 w-full rounded border cursor-pointer"
            />
          </div>
          <div>
            <Label className="text-xs">Contorno</Label>
            <input
              type="color"
              value={element.stroke}
              onChange={(e) => onUpdate({ stroke: e.target.value } as any)}
              className="mt-1 h-8 w-full rounded border cursor-pointer"
            />
          </div>
          <div>
            <Label className="text-xs">Opacidade</Label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={element.opacity}
              onChange={(e) => onUpdate({ opacity: Number(e.target.value) } as any)}
              className="w-full mt-1"
            />
          </div>
        </>
      )}

      {element.type === "arrow" && (
        <>
          <div>
            <Label className="text-xs">Cor</Label>
            <input
              type="color"
              value={element.color}
              onChange={(e) => onUpdate({ color: e.target.value } as any)}
              className="mt-1 h-8 w-full rounded border cursor-pointer"
            />
          </div>
          <div>
            <Label className="text-xs">Espessura</Label>
            <input
              type="range"
              min={1}
              max={12}
              value={element.strokeWidth}
              onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) } as any)}
              className="w-full mt-1"
            />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={element.dashed}
              onChange={(e) => onUpdate({ dashed: e.target.checked } as any)}
            />
            Tracejado
          </label>
        </>
      )}

      {/* Size */}
      <div className="grid grid-cols-2 gap-2 border-t pt-2">
        <div>
          <Label className="text-xs">Largura</Label>
          <Input
            type="number"
            value={Math.round(element.width)}
            min={20}
            onChange={(e) => onUpdate({ width: Number(e.target.value) } as any)}
            className="h-7 text-xs mt-0.5"
          />
        </div>
        <div>
          <Label className="text-xs">Altura</Label>
          <Input
            type="number"
            value={Math.round(element.height)}
            min={20}
            onChange={(e) => onUpdate({ height: Number(e.target.value) } as any)}
            className="h-7 text-xs mt-0.5"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Slides panel ─────────────────────────────────────────────────────────────

function SlidesPanel({
  slides,
  activeIndex,
  onSelect,
  onAdd,
  onDelete,
  teamColor,
}: {
  slides: BoardSlideData[];
  activeIndex: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
  onDelete: (i: number) => void;
  teamColor?: string;
}) {
  return (
    <div className="w-36 shrink-0 border-r flex flex-col overflow-hidden hidden md:flex">
      <div className="p-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Slides
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            onClick={() => onSelect(i)}
            className={`relative w-full rounded aspect-video border-2 text-left group transition-colors ${
              i === activeIndex
                ? "border-primary"
                : "border-transparent hover:border-muted-foreground/30"
            }`}
            style={{
              background:
                slide.background === "court" || slide.background === "half-court"
                  ? "#c8a96a"
                  : slide.background,
            }}
          >
            <span className="absolute bottom-1 left-1 text-[10px] text-white/80 font-medium drop-shadow">
              {i + 1}
            </span>
            {slide.title && (
              <span className="absolute inset-x-1 bottom-4 text-[9px] text-white/70 truncate drop-shadow">
                {slide.title}
              </span>
            )}
            {slides.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(i);
                }}
                className="absolute top-0.5 right-0.5 h-4 w-4 rounded text-white/60 hover:text-white hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                ×
              </button>
            )}
          </button>
        ))}
      </div>
      <div className="p-2 border-t">
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={onAdd}>
          <Plus className="h-3 w-3 mr-1" /> Slide
        </Button>
      </div>
    </div>
  );
}

// ─── Add Player dialog ────────────────────────────────────────────────────────

function AddPlayerDialog({
  open,
  players,
  onClose,
  onAdd,
}: {
  open: boolean;
  players: Player[];
  onClose: () => void;
  onAdd: (playerId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = players.filter((p) =>
    `${p.firstName} ${p.lastName} ${p.number}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar jogador</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Pesquisar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="max-h-64 overflow-y-auto space-y-1 mt-2">
          {filtered.map((p) => (
            <button
              key={p.id}
              className="w-full flex items-center gap-3 p-2 rounded hover:bg-accent text-left"
              onClick={() => {
                onAdd(p.id);
                onClose();
              }}
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  `${p.firstName[0]}${p.lastName[0]}`
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {p.firstName} {p.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  #{p.number} · {p.position}
                </p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sem resultados</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Background picker ────────────────────────────────────────────────────────

const BG_PRESETS = [
  { label: "Escuro", value: "#1e293b" },
  { label: "Preto", value: "#000000" },
  { label: "Branco", value: "#ffffff" },
  { label: "Campo", value: "court" },
  { label: "Meio-campo", value: "half-court" },
];

// ─── Main editor ──────────────────────────────────────────────────────────────

function makeDefaultSlide(): BoardSlideData {
  return {
    id: nanoid(8),
    title: "",
    background: "#1e293b",
    elements: [],
  };
}

type BoardWithSlides = Board & {
  slides: Array<{
    id: string;
    boardId: string;
    title: string;
    position: number;
    background: string;
    elementsJson: string;
    createdAt: string;
  }>;
};

export default function BoardEditor() {
  const params = useParams<{ id: string }>();
  const boardId = params.id!;
  const [, navigate] = useLocation();
  const { team } = useTeam();
  const qc = useQueryClient();

  const { data: boardData, isLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => api.get<BoardWithSlides>(`/api/boards/${boardId}`),
  });

  const { data: rawPlayers = [] } = useQuery({
    queryKey: ["players", team?.id],
    queryFn: () => api.get<Player[]>(`/api/players?teamId=${team!.id}`),
    enabled: !!team,
  });

  const players = useMemo(
    () => rawPlayers.filter((p) => p.active),
    [rawPlayers],
  );

  // ── Local slide state ────────────────────────────────────────────────────
  const [slides, setSlides] = useState<BoardSlideData[]>([makeDefaultSlide()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [boardName, setBoardName] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [undoStack, setUndoStack] = useState<BoardSlideData[][]>([]);

  // Refs to always have latest values available in event handlers / cleanup
  const slidesRef = useRef<BoardSlideData[]>([]);
  const boardNameRef = useRef("");
  const isDirtyRef = useRef(false);

  // Container for scale calculation
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function update() {
      if (!containerRef.current) return;
      const available = containerRef.current.clientWidth - 8;
      setScale(Math.min(1, available / CANVAS_W));
    }
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Initialize from DB ───────────────────────────────────────────────────
  useEffect(() => {
    if (!boardData) return;
    setBoardName(boardData.name);
    if (boardData.slides.length > 0) {
      setSlides(
        boardData.slides.map((s) => ({
          id: s.id,
          title: s.title,
          background: s.background,
          elements: (() => {
            try {
              return JSON.parse(s.elementsJson) as BoardElement[];
            } catch {
              return [];
            }
          })(),
        })),
      );
    } else {
      setSlides([makeDefaultSlide()]);
    }
    setIsDirty(false);
  }, [boardData]);

  // ── Keep refs in sync for use in event handlers / cleanup ───────────────
  useEffect(() => { slidesRef.current = slides; }, [slides]);
  useEffect(() => { boardNameRef.current = boardName; }, [boardName]);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // ── Auto-save ────────────────────────────────────────────────────────────
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (currentSlides: BoardSlideData[], currentName?: string) => {
      setIsSaving(true);
      try {
        const nameToSave = currentName ?? boardNameRef.current;
        await Promise.all([
          api.patch(`/api/boards/${boardId}`, { name: nameToSave }),
          api.put<{ ok: boolean }>(`/api/boards/${boardId}/slides`,
            currentSlides.map((s, i) => ({
              id: s.id,
              title: s.title,
              position: i,
              background: s.background,
              elementsJson: JSON.stringify(s.elements),
            })),
          ),
        ]);
        setIsDirty(false);
        isDirtyRef.current = false;
        qc.invalidateQueries({ queryKey: ["boards", team?.id] });
      } catch (err) {
        console.error("[board] save error", err);
        toast.error("Erro ao guardar");
      } finally {
        setIsSaving(false);
      }
    },
    [boardId, team?.id, qc],
  );

  // Flush pending save on unmount (e.g. navigating away)
  useEffect(() => {
    return () => {
      if (!isDirtyRef.current) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      void save(slidesRef.current);
    };
  }, [save]);

  // Guardar com keepalive no refresh/fecho do tab
  useEffect(() => {
    function onBeforeUnload() {
      if (!isDirtyRef.current) return;
      const token = getLastKnownToken();
      if (!token) return;
      const payload = slidesRef.current.map((s, i) => ({
        id: s.id,
        title: s.title,
        position: i,
        background: s.background,
        elementsJson: JSON.stringify(s.elements),
      }));
      // keepalive garante que o pedido é enviado mesmo que a página descarregue
      void fetch(`/api/boards/${boardId}/slides`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      void fetch(`/api/boards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: boardNameRef.current }),
        keepalive: true,
      });
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [boardId]);

  function markDirty(newSlides: BoardSlideData[]) {
    setIsDirty(true);
    isDirtyRef.current = true;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => save(newSlides), 500);
  }

  // ── Slide operations ─────────────────────────────────────────────────────
  const activeSlide = slides[activeIndex] ?? slides[0];

  function pushUndo() {
    setUndoStack((prev) => {
      const next = [...prev, slides].slice(-20);
      return next;
    });
  }

  function updateSlides(newSlides: BoardSlideData[]) {
    setSlides(newSlides);
    markDirty(newSlides);
  }

  function updateActiveSlide(patch: Partial<BoardSlideData>) {
    pushUndo();
    const newSlides = slides.map((s, i) =>
      i === activeIndex ? { ...s, ...patch } : s,
    );
    updateSlides(newSlides);
  }

  function addSlide() {
    const newSlide = makeDefaultSlide();
    const newSlides = [...slides, newSlide];
    updateSlides(newSlides);
    setActiveIndex(newSlides.length - 1);
    setSelectedId(null);
  }

  function deleteSlide(i: number) {
    if (slides.length <= 1) return;
    const newSlides = slides.filter((_, idx) => idx !== i);
    updateSlides(newSlides);
    setActiveIndex(Math.min(i, newSlides.length - 1));
    setSelectedId(null);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    updateSlides(prev);
  }

  // ── Element operations ───────────────────────────────────────────────────
  function addElement(el: BoardElement) {
    pushUndo();
    updateActiveSlide({ elements: [...activeSlide.elements, el] });
    setSelectedId(el.id);
  }

  function updateElement(id: string, patch: Partial<BoardElement>) {
    const newElements = activeSlide.elements.map((el) =>
      el.id === id ? ({ ...el, ...patch } as BoardElement) : el,
    );
    const newSlides = slides.map((s, i) =>
      i === activeIndex ? { ...s, elements: newElements } : s,
    );
    setSlides(newSlides);
    markDirty(newSlides);
  }

  function moveElement(id: string, x: number, y: number) {
    const newElements = activeSlide.elements.map((el) =>
      el.id === id ? ({ ...el, x, y } as BoardElement) : el,
    );
    const newSlides = slides.map((s, i) =>
      i === activeIndex ? { ...s, elements: newElements } : s,
    );
    setSlides(newSlides);
    markDirty(newSlides);
  }

  function deleteSelected() {
    if (!selectedId) return;
    pushUndo();
    updateActiveSlide({
      elements: activeSlide.elements.filter((el) => el.id !== selectedId),
    });
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selectedId) return;
    pushUndo();
    const el = activeSlide.elements.find((e) => e.id === selectedId);
    if (!el) return;
    const newEl: BoardElement = {
      ...el,
      id: nanoid(8),
      x: el.x + 20,
      y: el.y + 20,
      zIndex: el.zIndex + 1,
    } as BoardElement;
    updateActiveSlide({ elements: [...activeSlide.elements, newEl] });
    setSelectedId(newEl.id);
  }

  function maxZIndex() {
    return Math.max(0, ...activeSlide.elements.map((e) => e.zIndex));
  }

  function addPlayerElement(playerId: string) {
    addElement({
      id: nanoid(8),
      type: "player",
      playerId,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 140,
      height: 180,
      zIndex: maxZIndex() + 1,
      showPhoto: true,
      showNumber: true,
      showName: true,
      showPosition: true,
      cardColor: team?.primaryColor ?? "#1e40af",
    } as PlayerBoardElement);
  }

  function addTextElement() {
    const el: TextBoardElement = {
      id: nanoid(8),
      type: "text",
      content: "Texto",
      x: CANVAS_W / 2 - 100,
      y: CANVAS_H / 2 - 30,
      width: 200,
      height: 60,
      zIndex: maxZIndex() + 1,
      fontSize: 32,
      color: "#ffffff",
      bold: false,
      italic: false,
      align: "center",
    };
    addElement(el);
    setTimeout(() => setEditingTextId(el.id), 50);
  }

  function addShapeElement(shape: "rect" | "circle") {
    addElement({
      id: nanoid(8),
      type: "shape",
      shape,
      x: CANVAS_W / 2 - 80,
      y: CANVAS_H / 2 - 80,
      width: 160,
      height: 160,
      zIndex: maxZIndex() + 1,
      fill: team?.primaryColor ?? "#2563eb",
      stroke: "transparent",
      strokeWidth: 2,
      opacity: 0.85,
    } as ShapeBoardElement);
  }

  function addArrowElement() {
    addElement({
      id: nanoid(8),
      type: "arrow",
      x: 200,
      y: 200,
      x2: 500,
      y2: 350,
      width: 320,
      height: 160,
      zIndex: maxZIndex() + 1,
      color: "#facc15",
      strokeWidth: 4,
      dashed: false,
    } as ArrowBoardElement);
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (editingTextId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          deleteSelected();
        }
      }
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undo();
      }
      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        duplicateSelected();
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setEditingTextId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, editingTextId, deleteSelected, duplicateSelected, undo]);

  const selectedElement =
    activeSlide?.elements.find((e) => e.id === selectedId) ?? null;

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        A carregar…
      </div>
    );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate("/boards")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={boardName}
          onChange={(e) => {
            setBoardName(e.target.value);
            setIsDirty(true);
          }}
          onBlur={() => isDirty && save(slides, boardName)}
          className="h-8 max-w-[240px] font-semibold"
          placeholder="Nome da apresentação"
        />
        <div className="ml-auto flex items-center gap-2">
          {/* Slide navigation (mobile) */}
          <div className="flex items-center gap-1 md:hidden">
            <Button
              variant="ghost"
              size="sm"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((i) => i - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {activeIndex + 1}/{slides.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={activeIndex === slides.length - 1}
              onClick={() => setActiveIndex((i) => i + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            title="Imprimir / Exportar PDF"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </Button>
          <Button
            size="sm"
            onClick={() => save(slides, boardName)}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? "A guardar…" : isDirty ? "Guardar" : "Guardado"}
          </Button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/30 shrink-0 print:hidden overflow-x-auto">
        <Button size="sm" variant="outline" onClick={() => setAddPlayerOpen(true)} className="text-xs shrink-0">
          <Users className="h-3.5 w-3.5 mr-1" /> Jogador
        </Button>
        <Button size="sm" variant="outline" onClick={addTextElement} className="text-xs shrink-0">
          <Type className="h-3.5 w-3.5 mr-1" /> Texto
        </Button>
        <Button size="sm" variant="outline" onClick={() => addShapeElement("rect")} className="text-xs shrink-0">
          <Square className="h-3.5 w-3.5 mr-1" /> Rect
        </Button>
        <Button size="sm" variant="outline" onClick={() => addShapeElement("circle")} className="text-xs shrink-0">
          <Circle className="h-3.5 w-3.5 mr-1" /> Círculo
        </Button>
        <Button size="sm" variant="outline" onClick={addArrowElement} className="text-xs shrink-0">
          <Minus className="h-3.5 w-3.5 mr-1" /> Seta
        </Button>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {/* Background picker */}
        <div className="relative shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setShowBgPicker((v) => !v)}
          >
            <div
              className="h-3.5 w-3.5 rounded-sm border mr-1"
              style={{
                background:
                  activeSlide?.background === "court" ||
                  activeSlide?.background === "half-court"
                    ? "#c8a96a"
                    : activeSlide?.background,
              }}
            />
            Fundo
          </Button>
          {showBgPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg p-2 shadow-lg flex gap-1.5">
              {BG_PRESETS.map((p) => (
                <button
                  key={p.value}
                  title={p.label}
                  className={`flex flex-col items-center gap-0.5 p-1 rounded hover:bg-accent ${activeSlide?.background === p.value ? "ring-2 ring-primary" : ""}`}
                  onClick={() => {
                    updateActiveSlide({ background: p.value });
                    setShowBgPicker(false);
                  }}
                >
                  <div
                    className="h-8 w-12 rounded border"
                    style={{ background: p.value === "court" || p.value === "half-court" ? "#c8a96a" : p.value }}
                  />
                  <span className="text-[10px] text-muted-foreground">{p.label}</span>
                </button>
              ))}
              <button
                title="Cor personalizada"
                className="flex flex-col items-center gap-0.5 p-1 rounded hover:bg-accent"
              >
                <input
                  type="color"
                  value={activeSlide?.background?.startsWith("#") ? activeSlide.background : "#1e293b"}
                  onChange={(e) => {
                    updateActiveSlide({ background: e.target.value });
                    setShowBgPicker(false);
                  }}
                  className="h-8 w-12 rounded border cursor-pointer"
                />
                <span className="text-[10px] text-muted-foreground">Custom</span>
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        <Button
          size="sm"
          variant="ghost"
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Desfazer (Ctrl+Z)"
          className="shrink-0"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>

        {selectedId && (
          <>
            <Button size="sm" variant="ghost" onClick={duplicateSelected} title="Duplicar (Ctrl+D)" className="shrink-0">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={deleteSelected} title="Eliminar (Delete)" className="shrink-0 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Slides panel */}
        {activeSlide && (
          <SlidesPanel
            slides={slides}
            activeIndex={activeIndex}
            onSelect={(i) => {
              setActiveIndex(i);
              setSelectedId(null);
            }}
            onAdd={addSlide}
            onDelete={deleteSlide}
            teamColor={team?.primaryColor ?? undefined}
          />
        )}

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-2 flex items-start justify-center bg-muted/20"
          onClick={() => {
            setSelectedId(null);
            setEditingTextId(null);
            setShowBgPicker(false);
          }}
        >
          {activeSlide && (
            <div style={{ height: CANVAS_H * scale, width: CANVAS_W * scale }}>
              <BoardCanvas
                slide={activeSlide}
                players={players}
                selectedId={selectedId}
                editingTextId={editingTextId}
                scale={scale}
                onSelect={setSelectedId}
                onDeselect={() => {
                  setSelectedId(null);
                  setEditingTextId(null);
                }}
                onMoveElement={moveElement}
                onTextChange={(id, val) => updateElement(id, { content: val } as any)}
                onStartEditText={(id) => {
                  setSelectedId(id);
                  setEditingTextId(id);
                }}
              />
            </div>
          )}
        </div>

        {/* Properties panel */}
        <PropertiesPanel
          element={selectedElement}
          players={players}
          onUpdate={(patch) => selectedId && updateElement(selectedId, patch)}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          teamColor={team?.primaryColor ?? undefined}
        />
      </div>

      {/* Add player dialog */}
      <AddPlayerDialog
        open={addPlayerOpen}
        players={players}
        onClose={() => setAddPlayerOpen(false)}
        onAdd={addPlayerElement}
      />

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .board-print-canvas {
            display: block !important;
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            transform: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
