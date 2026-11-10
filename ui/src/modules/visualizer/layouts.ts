/**
 * The representations of the graph which are computed at once (the network is the only one running live, see
 * GraphCanvas). All of them are centered around the origin and deterministic.
 */

export interface Point {
  x: number;
  y: number;
}

export type LayoutKind = "network" | "hive" | "radial" | "circle";

export interface LayoutNode {
  id: string;
  name: string;
  type: string;
  color: string;
  space?: string;
  releaseStatus?: string;
  radius: number;
  in: number;
  out: number;
}

export interface LayoutLink {
  source: string;
  target: string;
}

/** What helps reading a static layout: the axes of a hive plot, the rings of a radial one, the groups of a circle. */
export type Guide =
  | { kind: "axis"; from: Point; to: Point; label: string; labelAt: Point; color: string; angle: number }
  | { kind: "ring"; r: number; label: string }
  | { kind: "arc"; r: number; start: number; end: number; label: string; labelAt: Point; color: string };

export interface StaticLayout {
  positions: Map<string, Point>;
  guides: Guide[];
  /** The angle (degrees) of the axis a node sits on - hive plots only */
  axisAngle: Map<string, number>;
  /** What the position along the axes (or rings) stands for */
  caption?: string;
}

export type HiveAxisBy = "type" | "space" | "role" | "release";
export type HiveRankBy = "connections" | "name" | "distance";

export interface HiveOptions {
  axisBy: HiveAxisBy;
  rankBy: HiveRankBy;
}

export const HIVE_AXIS_LABELS: Record<HiveAxisBy, string> = {
  type: "Type",
  space: "Space",
  role: "Role in the graph",
  release: "Release status",
};

export const HIVE_RANK_LABELS: Record<HiveRankBy, string> = {
  connections: "Connections",
  name: "Name (A–Z)",
  distance: "Distance from selection",
};

const AXIS_COLORS = ["#4f6bed", "#0ea5a4", "#e8590c", "#9c36b5", "#2f9e5c", "#d6336c"];
const OTHER_COLOR = "#868e96";
export const MAX_AXES = 6;
const AXIS_START = 70;
const AXIS_LENGTH = 300;

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const polar = (r: number, degrees: number): Point => ({ x: r * Math.cos(radians(degrees)), y: r * Math.sin(radians(degrees)) });
// A collator is far quicker than localeCompare when thousands of names are sorted
const collator = new Intl.Collator();
const byName = (a: LayoutNode, b: LayoutNode) => collator.compare(a.name, b.name) || collator.compare(a.id, b.id);
/** The largest value - unlike Math.max(...values) it has no limit on the number of values. */
const maxOf = (values: Iterable<number>, floor = -Infinity): number => {
  let max = floor;
  for (const value of values) {
    if (value > max) max = value;
  }
  return max;
};

const ROLE_ORDER = ["Sources", "Bridges", "Sinks", "Isolated"];
const ROLE_LABELS: Record<string, string> = {
  Sources: "Sources (only link out)",
  Bridges: "Bridges (link both ways)",
  Sinks: "Sinks (only linked to)",
  Isolated: "Isolated",
};

function groupOf(node: LayoutNode, axisBy: HiveAxisBy): string {
  switch (axisBy) {
    case "type":
      return node.type;
    case "space":
      return node.space || "Unknown space";
    case "release":
      return node.releaseStatus || "Not loaded yet";
    case "role":
      if (node.out > 0 && node.in === 0) return "Sources";
      if (node.in > 0 && node.out === 0) return "Sinks";
      if (node.in > 0 && node.out > 0) return "Bridges";
      return "Isolated";
  }
}

interface Group {
  key: string;
  label: string;
  color: string;
  nodes: LayoutNode[];
}

/** The groups the nodes are divided into - the biggest ones get an axis each, the rest share the last one. */
export function hiveGroups(nodes: LayoutNode[], axisBy: HiveAxisBy): Group[] {
  const byKey = new Map<string, LayoutNode[]>();
  nodes.forEach((node) => {
    const key = groupOf(node, axisBy);
    const members = byKey.get(key);
    if (members) {
      members.push(node);
    } else {
      byKey.set(key, [node]);
    }
  });
  let keys = [...byKey.keys()];
  keys =
    axisBy === "role"
      ? keys.sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b))
      : keys.sort((a, b) => byKey.get(b)!.length - byKey.get(a)!.length || a.localeCompare(b));

  const groups: Group[] = keys.map((key, i) => ({
    key,
    label: axisBy === "role" ? ROLE_LABELS[key] : key,
    color: axisBy === "type" ? byKey.get(key)![0].color : AXIS_COLORS[i % AXIS_COLORS.length],
    nodes: byKey.get(key)!,
  }));
  if (groups.length <= MAX_AXES) {
    return groups;
  }
  const rest = groups.slice(MAX_AXES - 1);
  return [
    ...groups.slice(0, MAX_AXES - 1),
    { key: "\u0000other", label: `Other (${rest.length})`, color: OTHER_COLOR, nodes: rest.flatMap((g) => g.nodes) },
  ];
}

/**
 * A hive plot: the nodes sit on a few radial axes - one per group - at a distance from the center which stands for a
 * quantity. Unlike the tangled network, the position of a node tells something, so dense graphs stay readable and the
 * structure of the links (which groups connect, and through which nodes) shows in the bundles between the axes.
 * Nodes crowding an axis spread over parallel lanes next to it.
 *
 * @param hops distance from the selection per node (for ranking by distance)
 */
export function hiveLayout(
  nodes: LayoutNode[],
  options: HiveOptions,
  hops: ReadonlyMap<string, number> = new Map(),
): StaticLayout {
  const positions = new Map<string, Point>();
  const axisAngle = new Map<string, number>();
  const guides: Guide[] = [];
  if (nodes.length === 0) {
    return { positions, guides, axisAngle };
  }
  const groups = hiveGroups(nodes, options.axisBy);
  const maxConnections = maxOf(
    nodes.map((n) => n.in + n.out),
    1,
  );
  const maxHops = maxOf(hops.values(), 1);

  const rank = (node: LayoutNode, index: number, count: number): number => {
    switch (options.rankBy) {
      case "connections":
        return Math.log1p(node.in + node.out) / Math.log1p(maxConnections);
      case "name":
        return count > 1 ? index / (count - 1) : 0.5;
      case "distance":
        return hops.has(node.id) ? hops.get(node.id)! / maxHops : 1;
    }
  };

  let outer = AXIS_START + AXIS_LENGTH;
  const placed: { group: Group; angle: number }[] = [];
  groups.forEach((group, i) => {
    const angle = -90 + (i * 360) / groups.length;
    placed.push({ group, angle });
    const sorted = [...group.nodes].sort(byName);
    const ranked = sorted
      .map((node, index) => ({ node, value: rank(node, index, sorted.length) }))
      .sort((a, b) => a.value - b.value || byName(a.node, b.node));

    const pitch = 2 * maxOf(group.nodes.map((n) => n.radius)) + 6;
    const lanes = Math.max(1, Math.ceil((sorted.length * pitch) / (2 * AXIS_LENGTH)));
    const lastOnLane: { r: number; radius: number }[] = Array.from({ length: lanes }, () => ({ r: -Infinity, radius: 0 }));
    ranked.forEach(({ node, value }, index) => {
      const lane = index % lanes;
      const previous = lastOnLane[lane];
      const ideal = AXIS_START + value * AXIS_LENGTH;
      const r = Math.max(ideal, previous.r + previous.radius + node.radius + 4);
      lastOnLane[lane] = { r, radius: node.radius };
      outer = Math.max(outer, r + node.radius);
      const offset = (lane - (lanes - 1) / 2) * pitch;
      const along = polar(r, angle);
      const across = polar(offset, angle + 90);
      positions.set(node.id, { x: along.x + across.x, y: along.y + across.y });
      axisAngle.set(node.id, angle);
    });
  });

  placed.forEach(({ group, angle }) => {
    guides.push({
      kind: "axis",
      from: polar(AXIS_START - 28, angle),
      to: polar(outer + 24, angle),
      label: `${group.label} · ${group.nodes.length}`,
      labelAt: polar(outer + 44, angle),
      color: group.color,
      angle,
    });
  });
  return {
    positions,
    guides,
    axisAngle,
    caption:
      options.rankBy === "connections"
        ? "Along each axis: more connections further out"
        : options.rankBy === "name"
          ? "Along each axis: A–Z from the center outwards"
          : "Along each axis: nearer to the selection is closer to the center",
  };
}

/** The nodes on a circle - grouped by type, the most connected first. Links are drawn through the middle. */
export function circleLayout(nodes: LayoutNode[]): StaticLayout {
  const positions = new Map<string, Point>();
  const guides: Guide[] = [];
  if (nodes.length === 0) {
    return { positions, guides, axisAngle: new Map() };
  }
  const groups = hiveGroups(nodes, "type").map((group) => ({
    ...group,
    nodes: [...group.nodes].sort((a, b) => b.in + b.out - (a.in + a.out) || byName(a, b)),
  }));
  const gap = 28;
  const circumference = nodes.reduce((sum, n) => sum + 2 * n.radius + 8, 0) + groups.length * gap;
  const r = Math.max(220, circumference / (2 * Math.PI));
  let cursor = -Math.PI / 2;
  groups.forEach((group) => {
    const start = cursor - gap / 2 / r;
    group.nodes.forEach((node) => {
      const step = (2 * node.radius + 8) / r;
      const angle = cursor + step / 2;
      positions.set(node.id, { x: r * Math.cos(angle), y: r * Math.sin(angle) });
      cursor += step;
    });
    const end = cursor - gap / 2 / r + gap / r;
    const mid = (start + end) / 2;
    guides.push({
      kind: "arc",
      r: r + 36,
      start: start + gap / r,
      end: end - gap / r,
      label: `${group.label} · ${group.nodes.length}`,
      labelAt: { x: (r + 62) * Math.cos(mid), y: (r + 62) * Math.sin(mid) },
      color: group.color,
    });
    cursor += gap / r;
  });
  return { positions, guides, axisAngle: new Map() };
}

/**
 * Rings around a focus node: everything it links to (in either direction) is on the first ring, what those link to on
 * the second, and so on. Nodes which can't be reached from it are on the outermost ring.
 */
export function radialLayout(nodes: LayoutNode[], links: LayoutLink[], focus: string | undefined): StaticLayout {
  const positions = new Map<string, Point>();
  const guides: Guide[] = [];
  if (nodes.length === 0) {
    return { positions, guides, axisAngle: new Map() };
  }
  const ids = new Set(nodes.map((n) => n.id));
  const degree = new Map(nodes.map((n) => [n.id, n.in + n.out]));
  const start =
    focus && ids.has(focus)
      ? focus
      : [...nodes].sort((a, b) => b.in + b.out - (a.in + a.out) || byName(a, b))[0].id;

  const adjacency = new Map<string, string[]>();
  const connect = (from: string, to: string) => {
    const list = adjacency.get(from);
    if (list) {
      list.push(to);
    } else {
      adjacency.set(from, [to]);
    }
  };
  links.forEach((link) => {
    if (ids.has(link.source) && ids.has(link.target)) {
      connect(link.source, link.target);
      connect(link.target, link.source);
    }
  });
  const parent = new Map<string, string | undefined>([[start, undefined]]);
  const ring = new Map<string, number>([[start, 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    (adjacency.get(queue[i]) ?? [])
      .sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || a.localeCompare(b))
      .forEach((next) => {
        if (!ring.has(next)) {
          ring.set(next, ring.get(queue[i])! + 1);
          parent.set(next, queue[i]);
          queue.push(next);
        }
      });
  }
  const unreachable = nodes.filter((n) => !ring.has(n.id));
  const deepest = maxOf(ring.values());
  const rings: LayoutNode[][] = Array.from({ length: deepest + 1 }, () => []);
  nodes.forEach((node) => ring.has(node.id) && rings[ring.get(node.id)!].push(node));
  if (unreachable.length > 0) {
    rings.push(unreachable);
  }

  const angleOf = new Map<string, number>();
  let radius = 0;
  rings.forEach((members, index) => {
    if (index === 0) {
      positions.set(members[0].id, { x: 0, y: 0 });
      angleOf.set(members[0].id, 0);
      return;
    }
    const needed = members.reduce((sum, n) => sum + 2 * n.radius + 8, 0) / (2 * Math.PI);
    radius = Math.max(radius + 110, needed);
    const ordered = [...members].sort(
      (a, b) =>
        (angleOf.get(parent.get(a.id) ?? "") ?? 0) - (angleOf.get(parent.get(b.id) ?? "") ?? 0) ||
        a.type.localeCompare(b.type) ||
        byName(a, b),
    );
    ordered.forEach((node, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / ordered.length;
      angleOf.set(node.id, angle);
      positions.set(node.id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    });
    const isUnreachable = unreachable.length > 0 && index === rings.length - 1;
    guides.push({ kind: "ring", r: radius, label: isUnreachable ? "Not connected" : index === 1 ? "1 hop" : `${index} hops` });
  });
  return { positions, guides, axisAngle: new Map(), caption: "Rings: number of links away from the center" };
}

/** What a link needs to be drawn: the path and where its label goes. */
export interface Route {
  d: string;
  label: Point;
}

export interface RouteContext {
  layout: LayoutKind;
  /** The angle of the axis (hive plots) of the node */
  axisAngle: ReadonlyMap<string, number>;
  /** Whether there is a link in the opposite direction (the network bends the two apart) */
  curved: boolean;
}

const unit = (from: Point, to: Point): Point => {
  const length = Math.max(Math.hypot(to.x - from.x, to.y - from.y), 0.0001);
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};

/** A cubic curve, shortened so it starts at the border of the source and ends (with room for the arrow) at the target. */
function cubic(start: Point, c1: Point, c2: Point, end: Point, sourceRadius: number, targetRadius: number, arrow: number): Route {
  const leave = unit(start, c1);
  const arrive = unit(end, c2);
  const s = { x: start.x + leave.x * sourceRadius, y: start.y + leave.y * sourceRadius };
  const e = { x: end.x + arrive.x * (targetRadius + arrow), y: end.y + arrive.y * (targetRadius + arrow) };
  const mid = {
    x: (s.x + 3 * c1.x + 3 * c2.x + e.x) / 8,
    y: (s.y + 3 * c1.y + 3 * c2.y + e.y) / 8,
  };
  const f = (n: number) => Math.round(n * 10) / 10;
  return { d: `M ${f(s.x)} ${f(s.y)} C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(e.x)} ${f(e.y)}`, label: mid };
}

const ARROW = 4;

/** The shape of a link in the given representation. */
export function routeOf(
  ctx: RouteContext,
  source: Point,
  target: Point,
  sourceRadius: number,
  targetRadius: number,
  sourceId: string,
  targetId: string,
): Route {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);

  switch (ctx.layout) {
    case "hive": {
      const a = ctx.axisAngle.get(sourceId);
      const b = ctx.axisAngle.get(targetId);
      if (a === undefined || b === undefined) {
        break;
      }
      const rs = Math.hypot(source.x, source.y);
      const rt = Math.hypot(target.x, target.y);
      if (a === b) {
        // Links within an axis bulge to the side, further the longer they are
        const side = polar(Math.min(120, distance * 0.45), a + 90);
        const mid = { x: (source.x + target.x) / 2 + side.x, y: (source.y + target.y) / 2 + side.y };
        return cubic(source, mid, mid, target, sourceRadius, targetRadius, ARROW);
      }
      const delta = ((((b - a) % 360) + 540) % 360) - 180;
      const middle = a + delta / 2;
      return cubic(source, polar(rs, middle), polar(rt, middle), target, sourceRadius, targetRadius, ARROW);
    }
    case "circle": {
      const pull = 0.25;
      const control = { x: ((source.x + target.x) / 2) * pull, y: ((source.y + target.y) / 2) * pull };
      return cubic(source, control, control, target, sourceRadius, targetRadius, ARROW);
    }
    case "radial":
    case "network":
      break;
  }

  const ux = dx / distance;
  const uy = dy / distance;
  const bend = ctx.curved && ctx.layout === "network" ? Math.min(40, distance / 4) : 0;
  const control = { x: (source.x + target.x) / 2 - uy * bend, y: (source.y + target.y) / 2 + ux * bend };
  if (bend === 0) {
    return cubic(source, { x: source.x + dx / 3, y: source.y + dy / 3 }, { x: source.x + (2 * dx) / 3, y: source.y + (2 * dy) / 3 }, target, sourceRadius, targetRadius, ARROW);
  }
  return cubic(source, control, control, target, sourceRadius, targetRadius, ARROW);
}

/** Where `routeCurve` leaves its result. */
export const ROUTE_SIZE = 11;
export const RouteAt = {
  StartX: 0,
  StartY: 1,
  Control1X: 2,
  Control1Y: 3,
  Control2X: 4,
  Control2Y: 5,
  EndX: 6,
  EndY: 7,
  LabelX: 8,
  LabelY: 9,
  /** 1 if the route is a straight line (the controls are not needed) */
  Straight: 10,
} as const;

function curveInto(out: Float64Array, sx: number, sy: number, c1x: number, c1y: number, c2x: number, c2y: number, tx: number, ty: number, sourceRadius: number, targetRadius: number): void {
  const leaveLength = Math.max(Math.hypot(c1x - sx, c1y - sy), 0.0001);
  const arriveLength = Math.max(Math.hypot(c2x - tx, c2y - ty), 0.0001);
  const startX = sx + ((c1x - sx) / leaveLength) * sourceRadius;
  const startY = sy + ((c1y - sy) / leaveLength) * sourceRadius;
  const reach = targetRadius + ARROW;
  const endX = tx + ((c2x - tx) / arriveLength) * reach;
  const endY = ty + ((c2y - ty) / arriveLength) * reach;
  out[RouteAt.StartX] = startX;
  out[RouteAt.StartY] = startY;
  out[RouteAt.Control1X] = c1x;
  out[RouteAt.Control1Y] = c1y;
  out[RouteAt.Control2X] = c2x;
  out[RouteAt.Control2Y] = c2y;
  out[RouteAt.EndX] = endX;
  out[RouteAt.EndY] = endY;
  out[RouteAt.LabelX] = (startX + 3 * c1x + 3 * c2x + endX) / 8;
  out[RouteAt.LabelY] = (startY + 3 * c1y + 3 * c2y + endY) / 8;
  out[RouteAt.Straight] = 0;
}

/**
 * The same routes as `routeOf`, without allocating anything - for drawing thousands of links per frame.
 * The result (see `RouteAt`) is written to `out`. The angles are those of the hive axes (NaN where there is none).
 */
export function routeCurve(
  layout: LayoutKind,
  curved: boolean,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  sourceRadius: number,
  targetRadius: number,
  sourceAngle: number,
  targetAngle: number,
  out: Float64Array,
): void {
  const dx = tx - sx;
  const dy = ty - sy;
  const distance = Math.max(Math.hypot(dx, dy), 1);

  if (layout === "hive" && !Number.isNaN(sourceAngle) && !Number.isNaN(targetAngle)) {
    const a = sourceAngle;
    const b = targetAngle;
    if (a === b) {
      const reach = Math.min(120, distance * 0.45);
      const side = radians(a + 90);
      const mx = (sx + tx) / 2 + reach * Math.cos(side);
      const my = (sy + ty) / 2 + reach * Math.sin(side);
      curveInto(out, sx, sy, mx, my, mx, my, tx, ty, sourceRadius, targetRadius);
      return;
    }
    const delta = ((((b - a) % 360) + 540) % 360) - 180;
    const middle = radians(a + delta / 2);
    const rs = Math.hypot(sx, sy);
    const rt = Math.hypot(tx, ty);
    curveInto(out, sx, sy, rs * Math.cos(middle), rs * Math.sin(middle), rt * Math.cos(middle), rt * Math.sin(middle), tx, ty, sourceRadius, targetRadius);
    return;
  }
  if (layout === "circle") {
    const pull = 0.25;
    const cx = ((sx + tx) / 2) * pull;
    const cy = ((sy + ty) / 2) * pull;
    curveInto(out, sx, sy, cx, cy, cx, cy, tx, ty, sourceRadius, targetRadius);
    return;
  }

  const ux = dx / distance;
  const uy = dy / distance;
  const bend = curved && layout === "network" ? Math.min(40, distance / 4) : 0;
  if (bend === 0) {
    curveInto(out, sx, sy, sx + dx / 3, sy + dy / 3, sx + (2 * dx) / 3, sy + (2 * dy) / 3, tx, ty, sourceRadius, targetRadius);
    out[RouteAt.Straight] = 1;
    return;
  }
  const cx = (sx + tx) / 2 - uy * bend;
  const cy = (sy + ty) / 2 + ux * bend;
  curveInto(out, sx, sy, cx, cy, cx, cy, tx, ty, sourceRadius, targetRadius);
}
