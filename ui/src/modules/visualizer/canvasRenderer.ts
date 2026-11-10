import { CANVAS_COLOR, GRAPHIC_CONTRAST, inkOn, legibleOn } from "./contrast";
import type { Guide, LayoutKind, LayoutNode } from "./layouts";
import { ROUTE_SIZE, RouteAt, routeCurve } from "./layouts";

/**
 * Draws the graph on a canvas. Everything is batched - nodes of a color share one path, as do the links - and what
 * can't be seen (outside the view, or too small to matter) is skipped, so thousands of nodes and links are painted
 * in a few milliseconds. No DOM elements are involved.
 */

export interface RenderNode extends LayoutNode {
  initial: string;
  status: "resolved" | "restricted" | "unresolved" | string;
  expandable: boolean;
}

export interface RenderLink {
  id: string;
  source: string;
  target: string;
  labels: string[];
  curved: boolean;
}

/** The part of the graph which only changes when nodes or links do - built once, not per frame. */
export interface Scene {
  nodes: RenderNode[];
  links: RenderLink[];
  index: Map<string, number>;
  /** Node index of both ends per link (-1 if the node isn't there) */
  linkSource: Int32Array;
  linkTarget: Int32Array;
  /** Neighbours per node (both directions), as compressed rows: adjacency[adjacencyStart[i] .. adjacencyStart[i + 1]) */
  adjacencyStart: Int32Array;
  adjacency: Int32Array;
  /** Resolved nodes by color - the unit of batching */
  buckets: Bucket[];
  ghosts: number[];
  /** The nodes in the order labels are handed out: the biggest (most connected) first */
  labelOrder: Int32Array;
  maxRadius: number;
  /** Says when the nodes or links are different - the layout has to be redone then */
  structure: string;
}

export interface Bucket {
  color: string;
  /** What outlines the node when white wouldn't stand out from the canvas */
  outline: string | undefined;
  ink: string;
  members: number[];
}

export interface Viewport {
  x: number;
  y: number;
  k: number;
  width: number;
  height: number;
  dpr: number;
}

export interface Frame {
  viewport: Viewport;
  x: Float64Array;
  y: Float64Array;
  layout: LayoutKind;
  /** The angle of the hive axis of each node (NaN for none) */
  angle: Float64Array | undefined;
  guides: Guide[];
  /** Index of the node under the pointer or selected - what the neighbours are highlighted for (-1 for none) */
  active: number;
  selected: number;
  /** The node the keyboard is on (-1 for none) */
  cursor: number;
  /** 1 for the nodes which stay in the foreground while one is active */
  focus: Uint8Array | undefined;
  labels: boolean;
  linkLabels: boolean;
  arrows: boolean;
  /** Draw less (no curves, arrows, labels): while the graph is in motion and big */
  lite: boolean;
  fontFamily: string;
}

const TAU = Math.PI * 2;
const MIN_SCREEN_RADIUS = 1.8;
const BADGE_RADIUS = 7.5;
const BADGE_OFFSET = 0.72;
const ACCENT = "#5b5fc7";
const LINK_COLOR = "#8793a5";
const GHOST_STROKE = "#868e96";
const LABEL_INK = "#343a40";
const MUTED_INK = "#5c636a";
const MAX_LABELS = 320;
const MAX_NEIGHBOUR_LABELS = 80;
const MAX_LINK_LABELS = 150;
const LABEL_MAX_CHARS = 30;
const GRID_CELL = 18;

/** How big a node is drawn: very small ones are kept visible when zoomed out. */
export const effectiveRadius = (radius: number, k: number): number => Math.max(radius, MIN_SCREEN_RADIUS / k);

/** The centre of the expand badge of a node (world coordinates). */
export const badgeCentre = (x: number, y: number, radius: number): [number, number] => [x + radius * BADGE_OFFSET, y + radius * BADGE_OFFSET];
export const BADGE_HIT_RADIUS = BADGE_RADIUS;
/** Zoomed out further than this, badges are left out. */
export const BADGE_MIN_ZOOM = 0.45;

export function buildScene(nodes: RenderNode[], links: RenderLink[]): Scene {
  const index = new Map<string, number>();
  nodes.forEach((node, i) => index.set(node.id, i));

  const linkSource = new Int32Array(links.length);
  const linkTarget = new Int32Array(links.length);
  const degree = new Int32Array(nodes.length);
  links.forEach((link, i) => {
    const s = index.get(link.source);
    const t = index.get(link.target);
    linkSource[i] = s ?? -1;
    linkTarget[i] = t ?? -1;
    if (s !== undefined && t !== undefined) {
      degree[s]++;
      degree[t]++;
    }
  });
  const adjacencyStart = new Int32Array(nodes.length + 1);
  for (let i = 0; i < nodes.length; i++) {
    adjacencyStart[i + 1] = adjacencyStart[i] + degree[i];
  }
  const adjacency = new Int32Array(adjacencyStart[nodes.length]);
  const cursor = adjacencyStart.slice(0, nodes.length);
  for (let i = 0; i < links.length; i++) {
    const s = linkSource[i];
    const t = linkTarget[i];
    if (s >= 0 && t >= 0) {
      adjacency[cursor[s]++] = t;
      adjacency[cursor[t]++] = s;
    }
  }

  const byColor = new Map<string, Bucket>();
  const ghosts: number[] = [];
  let maxRadius = 0;
  let hash = 2166136261;
  nodes.forEach((node, i) => {
    maxRadius = Math.max(maxRadius, node.radius);
    for (let c = 0; c < node.id.length; c++) {
      hash = Math.imul(hash ^ node.id.charCodeAt(c), 16777619);
    }
    if (node.status !== "resolved") {
      ghosts.push(i);
      return;
    }
    let bucket = byColor.get(node.color);
    if (!bucket) {
      const outline = legibleOn(node.color, undefined, GRAPHIC_CONTRAST);
      bucket = { color: node.color, outline: outline === node.color ? undefined : outline, ink: inkOn(node.color), members: [] };
      byColor.set(node.color, bucket);
    }
    bucket.members.push(i);
  });
  links.forEach((_, i) => {
    hash = Math.imul(hash ^ linkSource[i], 16777619);
    hash = Math.imul(hash ^ (linkTarget[i] + 1), 16777619);
  });

  const labelOrder = Int32Array.from({ length: nodes.length }, (_, i) => i).sort((a, b) => nodes[b].radius - nodes[a].radius || a - b);
  return {
    nodes,
    links,
    index,
    linkSource,
    linkTarget,
    adjacencyStart,
    adjacency,
    buckets: [...byColor.values()],
    ghosts,
    labelOrder,
    maxRadius,
    structure: `${nodes.length}:${links.length}:${(hash >>> 0).toString(36)}`,
  };
}

/** The node and its neighbours - the ones that stay in the foreground while the node is active. */
export function focusMask(scene: Scene, active: number, reuse?: Uint8Array): Uint8Array {
  const mask = reuse && reuse.length === scene.nodes.length ? reuse.fill(0) : new Uint8Array(scene.nodes.length);
  mask[active] = 1;
  for (let i = scene.adjacencyStart[active]; i < scene.adjacencyStart[active + 1]; i++) {
    mask[scene.adjacency[i]] = 1;
  }
  return mask;
}

const truncate = (text: string, max = LABEL_MAX_CHARS) => (text.length > max ? `${text.substring(0, max - 1)}…` : text);

const scratch = new Float64Array(ROUTE_SIZE);
const widths = new Map<string, number>();

function textWidth(ctx: CanvasRenderingContext2D, font: string, text: string): number {
  const key = `${font}|${text}`;
  let width = widths.get(key);
  if (width === undefined) {
    ctx.font = font;
    width = ctx.measureText(text).width;
    if (widths.size > 5000) {
      widths.clear();
    }
    widths.set(key, width);
  }
  return width;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function drawFrame(ctx: CanvasRenderingContext2D, scene: Scene, f: Frame): void {
  const v = f.viewport;
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  ctx.clearRect(0, 0, v.width, v.height);
  const count = scene.nodes.length;
  if (count === 0 || f.x.length < count) {
    return;
  }
  // The visible part of the world, with room for what sticks out (curves, halos, labels)
  const margin = 140 + 60 / v.k;
  const bounds: Bounds = {
    minX: -v.x / v.k - margin,
    maxX: (v.width - v.x) / v.k + margin,
    minY: -v.y / v.k - margin,
    maxY: (v.height - v.y) / v.k + margin,
  };

  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.scale(v.k, v.k);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawGuideShapes(ctx, f);
  drawLinks(ctx, scene, f, bounds);
  drawNodes(ctx, scene, f, bounds);
  ctx.restore();

  ctx.textBaseline = "alphabetic";
  drawGuideLabels(ctx, f);
  drawLabels(ctx, scene, f, bounds);
  drawLinkLabels(ctx, scene, f, bounds);
}

// ---- Guides ----

function drawGuideShapes(ctx: CanvasRenderingContext2D, f: Frame): void {
  const k = f.viewport.k;
  for (const guide of f.guides) {
    if (guide.kind === "axis") {
      const ink = legibleOn(guide.color, undefined, GRAPHIC_CONTRAST);
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(3.5, 1.5 / k);
      ctx.beginPath();
      ctx.moveTo(guide.from.x, guide.from.y);
      ctx.lineTo(guide.to.x, guide.to.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(guide.from.x, guide.from.y, 4, 0, TAU);
      ctx.fill();
    } else if (guide.kind === "arc") {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = legibleOn(guide.color, undefined, GRAPHIC_CONTRAST);
      ctx.lineWidth = Math.max(4, 1.5 / k);
      ctx.beginPath();
      ctx.arc(0, 0, guide.r, guide.start, guide.end);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = "#d5dbe5";
      ctx.lineWidth = Math.max(1, 1 / k);
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, guide.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

const anchorOf = (x: number, y: number): CanvasTextAlign => {
  const length = Math.hypot(x, y) || 1;
  const cos = x / length;
  return cos > 0.3 ? "left" : cos < -0.3 ? "right" : "center";
};

/** Text with a halo of the canvas color, so it stays readable on top of links and nodes. */
function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, halo: number): void {
  ctx.lineWidth = halo;
  ctx.strokeStyle = CANVAS_COLOR;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawGuideLabels(ctx: CanvasRenderingContext2D, f: Frame): void {
  const v = f.viewport;
  ctx.lineJoin = "round";
  for (const guide of f.guides) {
    if (guide.kind === "ring") {
      ctx.font = `400 11px ${f.fontFamily}`;
      ctx.textAlign = "center";
      haloText(ctx, guide.label, v.x, v.y + (-guide.r - 6) * v.k, MUTED_INK, 4);
    } else {
      ctx.font = `600 12px ${f.fontFamily}`;
      ctx.textAlign = anchorOf(guide.labelAt.x, guide.labelAt.y);
      haloText(ctx, truncate(guide.label, 38), v.x + guide.labelAt.x * v.k, v.y + guide.labelAt.y * v.k, legibleOn(guide.color), 4);
    }
  }
}

// ---- Links ----

function drawLinks(ctx: CanvasRenderingContext2D, scene: Scene, f: Frame, b: Bounds): void {
  const k = f.viewport.k;
  const base = new Path2D();
  const baseArrows = new Path2D();
  const active = new Path2D();
  const activeArrows = new Path2D();
  const arrows = f.arrows && !f.lite && k >= 0.3;
  const { linkSource, linkTarget, links, nodes } = scene;

  for (let i = 0; i < links.length; i++) {
    const s = linkSource[i];
    const t = linkTarget[i];
    if (s < 0 || t < 0) {
      continue;
    }
    const sx = f.x[s];
    const sy = f.y[s];
    const tx = f.x[t];
    const ty = f.y[t];
    if (Math.max(sx, tx) < b.minX || Math.min(sx, tx) > b.maxX || Math.max(sy, ty) < b.minY || Math.min(sy, ty) > b.maxY) {
      continue;
    }
    const isActive = s === f.active || t === f.active;
    const path = isActive ? active : base;
    if (f.lite) {
      path.moveTo(sx, sy);
      path.lineTo(tx, ty);
      continue;
    }
    routeCurve(f.layout, links[i].curved, sx, sy, tx, ty, nodes[s].radius, nodes[t].radius, f.angle ? f.angle[s] : NaN, f.angle ? f.angle[t] : NaN, scratch);
    path.moveTo(scratch[RouteAt.StartX], scratch[RouteAt.StartY]);
    const straight = scratch[RouteAt.Straight] === 1;
    if (straight) {
      path.lineTo(scratch[RouteAt.EndX], scratch[RouteAt.EndY]);
    } else {
      path.bezierCurveTo(scratch[RouteAt.Control1X], scratch[RouteAt.Control1Y], scratch[RouteAt.Control2X], scratch[RouteAt.Control2Y], scratch[RouteAt.EndX], scratch[RouteAt.EndY]);
    }
    if (arrows) {
      const ex = scratch[RouteAt.EndX];
      const ey = scratch[RouteAt.EndY];
      const fromX = straight ? scratch[RouteAt.StartX] : scratch[RouteAt.Control2X];
      const fromY = straight ? scratch[RouteAt.StartY] : scratch[RouteAt.Control2Y];
      const length = Math.max(Math.hypot(ex - fromX, ey - fromY), 0.0001);
      const dx = (ex - fromX) / length;
      const dy = (ey - fromY) / length;
      const arrow = isActive ? activeArrows : baseArrows;
      const size = isActive ? 9 : 7.5;
      const half = size * 0.42;
      const tipX = ex + dx * 3;
      const tipY = ey + dy * 3;
      const backX = tipX - dx * size;
      const backY = tipY - dy * size;
      arrow.moveTo(tipX, tipY);
      arrow.lineTo(backX - dy * half, backY + dx * half);
      arrow.lineTo(backX + dy * half, backY - dx * half);
      arrow.closePath();
    }
  }

  ctx.globalAlpha = f.focus ? 0.1 : 0.85;
  ctx.strokeStyle = LINK_COLOR;
  ctx.fillStyle = LINK_COLOR;
  ctx.lineWidth = Math.max(1.4, 0.9 / k);
  ctx.stroke(base);
  ctx.fill(baseArrows);

  if (f.active >= 0) {
    const color = legibleOn(nodes[f.active].color, undefined, GRAPHIC_CONTRAST);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2.4, 1.4 / k);
    ctx.stroke(active);
    ctx.fill(activeArrows);
  }
  ctx.globalAlpha = 1;
}

// ---- Nodes ----

function drawNodes(ctx: CanvasRenderingContext2D, scene: Scene, f: Frame, b: Bounds): void {
  const { nodes, buckets } = scene;
  const k = f.viewport.k;
  const focus = f.focus;

  // Halo and ring of the active and selected nodes sit beneath the bodies
  const halo = (i: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = nodes[i].color;
    ctx.beginPath();
    ctx.arc(f.x[i], f.y[i], effectiveRadius(nodes[i].radius, k) + 9, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  if (f.active >= 0) halo(f.active, f.active === f.selected ? 0.26 : 0.16);
  if (f.selected >= 0 && f.selected !== f.active) halo(f.selected, 0.26);

  // Dimmed nodes first (when something is in focus), then the ones in the foreground
  for (const pass of focus ? [0, 1] : [1]) {
    ctx.globalAlpha = pass === 0 ? 0.16 : 1;
    for (const bucket of buckets) {
      ctx.beginPath();
      let drawn = 0;
      for (const i of bucket.members) {
        if (focus && focus[i] !== pass) continue;
        const x = f.x[i];
        const y = f.y[i];
        if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
        const r = effectiveRadius(nodes[i].radius, k);
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
        drawn++;
      }
      if (drawn === 0) continue;
      ctx.fillStyle = bucket.color;
      ctx.fill();
      if (k >= 0.3) {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = bucket.outline ?? "#fff";
        ctx.stroke();
      }
    }
    drawGhosts(ctx, scene, f, b, pass);
    if (!f.lite && pass === 1) {
      drawInitials(ctx, scene, f, b);
      if (k >= BADGE_MIN_ZOOM) drawBadges(ctx, scene, f, b);
    }
  }
  ctx.globalAlpha = 1;

  // Selection ring and the keyboard cursor
  if (f.selected >= 0) {
    ctx.strokeStyle = legibleOn(nodes[f.selected].color, undefined, GRAPHIC_CONTRAST);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(f.x[f.selected], f.y[f.selected], effectiveRadius(nodes[f.selected].radius, k) + 4, 0, TAU);
    ctx.stroke();
  }
  if (f.cursor >= 0) {
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(f.x[f.cursor], f.y[f.cursor], effectiveRadius(nodes[f.cursor].radius, k) + 4, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawGhosts(ctx: CanvasRenderingContext2D, scene: Scene, f: Frame, b: Bounds, pass: number): void {
  if (scene.ghosts.length === 0) {
    return;
  }
  const { nodes } = scene;
  const k = f.viewport.k;
  const shapes = new Path2D();
  const locks = new Path2D();
  const questions: number[] = [];
  let drawn = 0;
  for (const i of scene.ghosts) {
    if (f.focus && f.focus[i] !== pass) continue;
    const x = f.x[i];
    const y = f.y[i];
    if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
    const r = effectiveRadius(nodes[i].radius, k);
    shapes.moveTo(x + r, y);
    shapes.arc(x, y, r, 0, TAU);
    drawn++;
    if (r * k >= 7) {
      if (nodes[i].status === "restricted") {
        locks.rect(x - r * 0.4, y - r * 0.05, r * 0.8, r * 0.55);
        locks.moveTo(x - r * 0.25, y - r * 0.05);
        locks.arc(x, y - r * 0.05, r * 0.25, Math.PI, 0);
      } else {
        questions.push(i);
      }
    }
  }
  if (drawn === 0) {
    return;
  }
  ctx.fillStyle = "#fff";
  ctx.fill(shapes);
  ctx.strokeStyle = GHOST_STROKE;
  ctx.lineWidth = 1.75;
  ctx.setLineDash([4, 3]);
  ctx.stroke(shapes);
  ctx.setLineDash([]);
  ctx.strokeStyle = "#6c757d";
  ctx.lineWidth = Math.max(1.4, nodes[scene.ghosts[0]].radius * 0.14);
  ctx.stroke(locks);
  if (questions.length > 0) {
    ctx.fillStyle = "#6c757d";
    ctx.textAlign = "center";
    for (const i of questions) {
      const size = Math.round(nodes[i].radius * 1.1);
      ctx.font = `700 ${size}px ${f.fontFamily}`;
      ctx.fillText("?", f.x[i], f.y[i] + size * 0.36);
    }
  }
}

function drawInitials(ctx: CanvasRenderingContext2D, scene: Scene, f: Frame, b: Bounds): void {
  const { nodes } = scene;
  const k = f.viewport.k;
  ctx.textAlign = "center";
  for (const bucket of scene.buckets) {
    ctx.fillStyle = bucket.ink;
    for (const i of bucket.members) {
      const node = nodes[i];
      // Too small to hold a letter - the same cut-off as before: radius 11 at the least, and a readable size on screen
      if (node.radius < 11 || node.radius * 0.95 * k < 7) continue;
      const x = f.x[i];
      const y = f.y[i];
      if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
      if (f.focus && f.focus[i] !== 1) continue;
      const size = Math.round(node.radius * 0.95);
      ctx.font = `700 ${size}px ${f.fontFamily}`;
      ctx.fillText(node.initial, x, y + size * 0.36);
    }
  }
}

function drawBadges(ctx: CanvasRenderingContext2D, scene: Scene, f: Frame, b: Bounds): void {
  const { nodes } = scene;
  const discs = new Path2D();
  const signs = new Path2D();
  let drawn = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (!nodes[i].expandable) continue;
    if (f.focus && f.focus[i] !== 1) continue;
    const x = f.x[i];
    const y = f.y[i];
    if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
    const [cx, cy] = badgeCentre(x, y, effectiveRadius(nodes[i].radius, f.viewport.k));
    discs.moveTo(cx + BADGE_RADIUS, cy);
    discs.arc(cx, cy, BADGE_RADIUS, 0, TAU);
    signs.moveTo(cx - 3.2, cy);
    signs.lineTo(cx + 3.2, cy);
    signs.moveTo(cx, cy - 3.2);
    signs.lineTo(cx, cy + 3.2);
    drawn++;
  }
  if (drawn === 0) {
    return;
  }
  ctx.fillStyle = "#fff";
  ctx.fill(discs);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5;
  ctx.stroke(discs);
  ctx.lineWidth = 1.8;
  ctx.stroke(signs);
}

// ---- Labels (screen space: constant size, and kept from overlapping) ----

class Occupancy {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: Uint8Array;

  constructor(width: number, height: number) {
    this.cols = Math.ceil(width / GRID_CELL) + 1;
    this.rows = Math.ceil(height / GRID_CELL) + 1;
    this.cells = new Uint8Array(this.cols * this.rows);
  }

  /** Marks the box as taken - returns false (and marks nothing) if part of it was taken and `force` is not set. */
  take(x0: number, y0: number, x1: number, y1: number, force: boolean): boolean {
    const c0 = Math.max(0, Math.floor(x0 / GRID_CELL));
    const c1 = Math.min(this.cols - 1, Math.floor(x1 / GRID_CELL));
    const r0 = Math.max(0, Math.floor(y0 / GRID_CELL));
    const r1 = Math.min(this.rows - 1, Math.floor(y1 / GRID_CELL));
    if (!force) {
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (this.cells[r * this.cols + c]) return false;
        }
      }
    }
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        this.cells[r * this.cols + c] = 1;
      }
    }
    return true;
  }
}

function drawLabels(ctx: CanvasRenderingContext2D, scene: Scene, f: Frame, b: Bounds): void {
  const { nodes } = scene;
  const v = f.viewport;
  const font = `500 11.5px ${f.fontFamily}`;
  const italic = `italic 500 11.5px ${f.fontFamily}`;
  const occupied = new Occupancy(v.width, v.height);
  const done = new Set<number>();
  ctx.textAlign = "center";
  ctx.lineJoin = "round";

  const place = (i: number, force: boolean): void => {
    if (done.has(i)) return;
    const node = nodes[i];
    const worldX = f.x[i];
    const worldY = f.y[i];
    if (worldX < b.minX || worldX > b.maxX || worldY < b.minY || worldY > b.maxY) return;
    const r = effectiveRadius(node.radius, v.k) * v.k;
    const sx = v.x + worldX * v.k;
    const sy = v.y + worldY * v.k + r + 14;
    if (sx < -80 || sx > v.width + 80 || sy < -20 || sy > v.height + 20) return;
    const text = truncate(node.name);
    const style = node.status === "resolved" ? font : italic;
    const half = textWidth(ctx, style, text) / 2;
    if (!occupied.take(sx - half - 2, sy - 12, sx + half + 2, sy + 4, force)) return;
    done.add(i);
    ctx.font = style;
    haloText(ctx, text, sx, sy, node.status === "resolved" ? LABEL_INK : MUTED_INK, 4);
  };

  // Always named: what is active, selected or under the keyboard - and what it links to
  if (f.active >= 0) place(f.active, true);
  if (f.selected >= 0) place(f.selected, true);
  if (f.cursor >= 0) place(f.cursor, true);
  if (f.focus && f.active >= 0) {
    let named = 0;
    for (let a = scene.adjacencyStart[f.active]; a < scene.adjacencyStart[f.active + 1] && named < MAX_NEIGHBOUR_LABELS; a++) {
      place(scene.adjacency[a], false);
      named++;
    }
  }
  if (!f.labels || f.lite) {
    return;
  }
  // The rest: the biggest first, as many as fit
  let shown = 0;
  for (let n = 0; n < scene.labelOrder.length && shown < MAX_LABELS; n++) {
    const i = scene.labelOrder[n];
    if (f.focus && f.focus[i] !== 1) continue;
    if (effectiveRadius(nodes[i].radius, v.k) * v.k < 3.5) break; // sorted by size - the rest is smaller still
    const before = done.size;
    place(i, false);
    if (done.size > before) shown++;
  }
}

function drawLinkLabels(ctx: CanvasRenderingContext2D, scene: Scene, f: Frame, b: Bounds): void {
  const v = f.viewport;
  if ((!f.linkLabels && f.active < 0) || f.lite) {
    return;
  }
  const { linkSource, linkTarget, links, nodes } = scene;
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  let shown = 0;
  for (let i = 0; i < links.length && shown < MAX_LINK_LABELS; i++) {
    const link = links[i];
    const s = linkSource[i];
    const t = linkTarget[i];
    if (link.labels.length === 0 || s < 0 || t < 0) continue;
    const isActive = s === f.active || t === f.active;
    if (!isActive && (!f.linkLabels || v.k < 0.5 || f.focus)) continue;
    const sx = f.x[s];
    const sy = f.y[s];
    const tx = f.x[t];
    const ty = f.y[t];
    if (Math.max(sx, tx) < b.minX || Math.min(sx, tx) > b.maxX || Math.max(sy, ty) < b.minY || Math.min(sy, ty) > b.maxY) continue;
    routeCurve(f.layout, link.curved, sx, sy, tx, ty, nodes[s].radius, nodes[t].radius, f.angle ? f.angle[s] : NaN, f.angle ? f.angle[t] : NaN, scratch);
    ctx.font = `${isActive ? 600 : 400} 10px ${f.fontFamily}`;
    haloText(ctx, truncate(link.labels.join(", "), 28), v.x + scratch[RouteAt.LabelX] * v.k, v.y + scratch[RouteAt.LabelY] * v.k + 3, isActive ? "#212529" : MUTED_INK, 3);
    shown++;
  }
}
