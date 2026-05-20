/** Dimensões lógicas do canvas de apresentação (16:9). */
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

interface BoardElementBase {
  id: string;
  x: number;      // px no espaço lógico do canvas
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface PlayerBoardElement extends BoardElementBase {
  type: "player";
  playerId: string;
  showPhoto: boolean;
  showNumber: boolean;
  showName: boolean;
  showPosition: boolean;
  cardColor?: string;
}

export interface TextBoardElement extends BoardElementBase {
  type: "text";
  content: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  background?: string;
}

export interface ShapeBoardElement extends BoardElementBase {
  type: "shape";
  shape: "rect" | "circle";
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export interface ArrowBoardElement extends BoardElementBase {
  type: "arrow";
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
  dashed: boolean;
}

export type BoardElement =
  | PlayerBoardElement
  | TextBoardElement
  | ShapeBoardElement
  | ArrowBoardElement;

/** Cor hex, ou "court" para campo de voleibol, ou "half-court" para meio-campo. */
export type BoardBackground = string;

export interface BoardSlideData {
  id: string;
  title: string;
  background: BoardBackground;
  elements: BoardElement[];
}
