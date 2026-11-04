import type { Point } from "./graphLayout";

/** The key the positions of the nodes of the type graph are stored with in the local storage of the browser. */
export const POSITIONS_KEY = "marmotgraph.modeler.positions";

/**
 * The positions of the types placed by the user in the coordinate system of the graph (by the full name of the type) -
 * empty if there are none or the storage is not available.
 */
export function loadPositions(): Map<string, Point> {
  try {
    const stored = JSON.parse(localStorage.getItem(POSITIONS_KEY) ?? "{}") as Record<string, unknown>;
    const positions = new Map<string, Point>();
    Object.entries(stored).forEach(([type, value]) => {
      if (Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === "number" && Number.isFinite(v))) {
        positions.set(type, { x: value[0], y: value[1] });
      }
    });
    return positions;
  } catch {
    return new Map();
  }
}

/**
 * Stores the positions of the types - an empty map removes them (e.g. to lay out the graph again). The positions are
 * rounded to keep the storage small - the rounded positions are returned so they can be shown as they are restored.
 */
export function savePositions(positions: ReadonlyMap<string, Point>): Map<string, Point> {
  const round = (value: number) => Math.round(value * 10) / 10;
  const rounded = new Map([...positions].map(([type, p]) => [type, { x: round(p.x), y: round(p.y) }]));
  try {
    if (rounded.size === 0) {
      localStorage.removeItem(POSITIONS_KEY);
    } else {
      const stored: Record<string, [number, number]> = {};
      rounded.forEach((p, type) => (stored[type] = [p.x, p.y]));
      localStorage.setItem(POSITIONS_KEY, JSON.stringify(stored));
    }
  } catch {
    // The positions are a convenience - they are just not kept if the storage is not available (e.g. private mode)
  }
  return rounded;
}
