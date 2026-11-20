import { HIVE_AXIS_LABELS, HIVE_RANK_LABELS, HiveAxisBy, HiveOptions, HiveRankBy, LayoutKind } from "./layouts";

/**
 * The address of the visualizer says what is looked at:
 *
 *   /visualizer                                   the exploration of this browser tab
 *   /visualizer/instances/:id                     an instance in focus (selected, its links loaded)
 *   /visualizer/instances/:id?layout=hive         ... read as a hive plot
 *   /visualizer/instances/:id?layout=hive&axes=space&rank=name
 *
 * The instance is the thing that is addressed, so it is in the path (as in /editor/instances/:id). How it is shown is
 * a view of it, so it is in the query: the same link can be opened as a network, a hive plot, rings or a circle.
 */

export const DEFAULT_LAYOUT: LayoutKind = "network";
export const DEFAULT_HIVE: HiveOptions = { axisBy: "type", rankBy: "connections" };

const LAYOUT_KINDS: readonly LayoutKind[] = ["network", "hive", "radial", "circle"];

const isLayout = (value: string | null): value is LayoutKind => LAYOUT_KINDS.includes(value as LayoutKind);
const isAxisBy = (value: string | null): value is HiveAxisBy => value !== null && Object.prototype.hasOwnProperty.call(HIVE_AXIS_LABELS, value);
const isRankBy = (value: string | null): value is HiveRankBy => value !== null && Object.prototype.hasOwnProperty.call(HIVE_RANK_LABELS, value);

export interface VisualizerView {
  layout: LayoutKind;
  hive: HiveOptions;
}

/** The view an address asks for - only what it says, unknown values are ignored. */
export function viewFromSearch(search: URLSearchParams): { layout?: LayoutKind; hive?: Partial<HiveOptions> } {
  const layout = search.get("layout");
  const axes = search.get("axes");
  const rank = search.get("rank");
  const hive: Partial<HiveOptions> = {};
  if (isAxisBy(axes)) hive.axisBy = axes;
  if (isRankBy(rank)) hive.rankBy = rank;
  return {
    layout: isLayout(layout) ? layout : undefined,
    hive: Object.keys(hive).length > 0 ? hive : undefined,
  };
}

/** The instance of /visualizer/instances/:id - `rest` is what the route leaves after /visualizer/. */
export function instanceFromRest(rest: string | undefined): string | undefined {
  const match = /^instances\/([^/]+)\/?$/.exec(rest ?? "");
  if (!match) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

/** The address of a view: what is not the default is left out, so the links stay short. */
export function visualizerPath(instanceId: string | undefined, view: Partial<VisualizerView> = {}): string {
  const path = instanceId ? `/visualizer/instances/${encodeURIComponent(instanceId)}` : "/visualizer";
  const query = new URLSearchParams();
  const layout = view.layout ?? DEFAULT_LAYOUT;
  if (layout !== DEFAULT_LAYOUT) {
    query.set("layout", layout);
  }
  if (layout === "hive" && view.hive) {
    if (view.hive.axisBy !== DEFAULT_HIVE.axisBy) query.set("axes", view.hive.axisBy);
    if (view.hive.rankBy !== DEFAULT_HIVE.rankBy) query.set("rank", view.hive.rankBy);
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
