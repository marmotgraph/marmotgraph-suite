import type { LinkedInstance, LinkStatus, ReleaseStatus } from "../editor/editorMockData";
import type { IncomingLinks, InstanceDetail, InstanceField } from "../../services/instances";

/** Types without a color of their own get one of these (by their name) so they can still be told apart. */
const FALLBACK_COLORS = [
  "#4f6bed",
  "#0ea5a4",
  "#e8590c",
  "#9c36b5",
  "#2f9e5c",
  "#d6336c",
  "#1c7ed6",
  "#c9a227",
  "#7048e8",
  "#e03131",
  "#0b7285",
  "#5c940d",
];

/** The color shown for a type - its own, otherwise a stable one derived from its name. */
export function typeColorOf(type: string, color?: string): string {
  if (color) {
    return color;
  }
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = (hash * 31 + type.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

/** A value of an instance shown in the node panel. */
export interface NodeProperty {
  label: string;
  value: string;
}

/** An instance in the graph. Restricted and unresolved targets are kept (as ghosts) so the connection stays visible. */
export interface GraphNode {
  id: string;
  name: string;
  /** The name of the type - nodes are grouped by it. */
  type: string;
  color: string;
  status: LinkStatus;
  space?: string;
  releaseStatus?: ReleaseStatus;
  contributed?: boolean;
  /** Whether its links have been loaded into the graph. */
  expanded: boolean;
  /** Whether the instance is known to have links which are not part of the graph (yet) - undefined if unknown. */
  hasDirectLinks?: boolean;
  hasReverseLinks?: boolean;
  properties?: NodeProperty[];
}

/** A connection between two instances - several properties between the same pair are merged into one link. */
export interface GraphLink {
  id: string;
  source: string;
  target: string;
  labels: string[];
}

export interface Graph {
  nodes: ReadonlyMap<string, GraphNode>;
  links: ReadonlyMap<string, GraphLink>;
}

export const EMPTY_GRAPH: Graph = { nodes: new Map(), links: new Map() };

/** The last segment of an identifier (e.g. of a property). */
export function shortName(identifier: string): string {
  const cut = Math.max(identifier.lastIndexOf("/"), identifier.lastIndexOf("#"));
  return identifier.substring(cut + 1) || identifier;
}

const PROPERTY_KINDS = new Set(["TEXT", "TEXTAREA", "TEXTS", "NUMBER", "DATE", "DATETIME", "TIME", "CHECKBOX"]);
const MAX_PROPERTIES = 8;

function propertyValue(field: InstanceField): string | undefined {
  const value = field.value;
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (Array.isArray(value)) {
    const texts = value.filter((v) => typeof v === "string" && v).join(", ");
    return texts || undefined;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return typeof value === "object" ? undefined : String(value);
}

/** The plain values of an instance (its label property is the name already) - for the node panel. */
export function propertiesOf(fields: InstanceField[] | undefined): NodeProperty[] {
  const properties: NodeProperty[] = [];
  (fields ?? []).forEach((field) => {
    if (properties.length >= MAX_PROPERTIES || field.labelProperty || !PROPERTY_KINDS.has(field.kind)) {
      return;
    }
    const value = propertyValue(field);
    if (value) {
      properties.push({ label: field.label, value });
    }
  });
  return properties;
}

/** The node for an instance which is only known from a link of another one. */
export function nodeOfLink(link: Pick<LinkedInstance, "instanceId" | "instanceName" | "type" | "typeColor" | "space" | "linkStatus" | "hasDirectLinks" | "hasReverseLinks">): GraphNode {
  const status = link.linkStatus ?? "resolved";
  const type = link.type || "Unknown type";
  return {
    id: link.instanceId,
    name:
      status === "restricted"
        ? "Restricted instance"
        : status === "unresolved"
          ? "Unknown connection"
          : link.instanceName || link.instanceId,
    type,
    color: status === "resolved" ? typeColorOf(type, link.typeColor) : "#adb5bd",
    status,
    space: link.space || undefined,
    expanded: false,
    hasDirectLinks: link.hasDirectLinks,
    hasReverseLinks: link.hasReverseLinks,
  };
}

/** The node for an instance as shown in its detail view. */
export function nodeOfDetail(detail: InstanceDetail, expanded: boolean): GraphNode {
  return {
    id: detail.instanceId,
    name: detail.instanceName || detail.instanceId,
    type: detail.type,
    color: typeColorOf(detail.type, detail.typeColor),
    status: "resolved",
    space: detail.space,
    releaseStatus: detail.releaseStatus,
    contributed: detail.contributed,
    expanded,
    properties: propertiesOf(detail.fields),
  };
}

/** Merges what is known about an instance - a resolved node is never replaced by a ghost, known facts are kept. */
function merge(known: GraphNode | undefined, next: GraphNode): GraphNode {
  if (!known) {
    return next;
  }
  if (known.status === "resolved" && next.status !== "resolved") {
    return known;
  }
  return {
    ...known,
    ...next,
    space: next.space ?? known.space,
    releaseStatus: next.releaseStatus ?? known.releaseStatus,
    contributed: next.contributed ?? known.contributed,
    properties: next.properties ?? known.properties,
    expanded: known.expanded || next.expanded,
    hasDirectLinks: next.hasDirectLinks ?? known.hasDirectLinks,
    hasReverseLinks: next.hasReverseLinks ?? known.hasReverseLinks,
  };
}

export function linkId(source: string, target: string): string {
  return `${source}>${target}`;
}

/** Adds the nodes and links - the same graph is returned if nothing is new. */
export function addToGraph(graph: Graph, nodes: GraphNode[], links: { source: string; target: string; label?: string }[]): Graph {
  const nextNodes = new Map(graph.nodes);
  const nextLinks = new Map(graph.links);
  nodes.forEach((node) => nextNodes.set(node.id, merge(nextNodes.get(node.id), node)));
  links.forEach(({ source, target, label }) => {
    if (source === target || !nextNodes.has(source) || !nextNodes.has(target)) {
      return;
    }
    const id = linkId(source, target);
    const known = nextLinks.get(id);
    const labels = known ? [...known.labels] : [];
    if (label && !labels.some((l) => l.toLowerCase() === label.toLowerCase())) {
      labels.push(label);
    }
    nextLinks.set(id, { id, source, target, labels });
  });
  return { nodes: nextNodes, links: nextLinks };
}

/** Adds an instance with the instances it links to (the ones it can't be linked to are kept as ghosts). */
export function addDetail(graph: Graph, detail: InstanceDetail, limit = Infinity): { graph: Graph; omitted: number } {
  const links = (detail.directLinks ?? []).slice(0, limit);
  const omitted = Math.max(0, (detail.directLinks ?? []).length - links.length);
  return {
    graph: addToGraph(
      graph,
      [nodeOfDetail(detail, true), ...links.map(nodeOfLink)],
      links.map((link) => ({ source: detail.instanceId, target: link.instanceId, label: link.fieldLabel })),
    ),
    omitted,
  };
}

/** Adds the instances linking to the given one. */
export function addIncoming(graph: Graph, instanceId: string, incoming: IncomingLinks[]): Graph {
  const nodes: GraphNode[] = [];
  const links: { source: string; target: string; label?: string }[] = [];
  incoming.forEach((group) =>
    group.types.forEach((type) =>
      type.links.forEach((link) => {
        nodes.push(nodeOfLink({ ...link, type: type.type, typeColor: type.typeColor }));
        links.push({ source: link.instanceId, target: instanceId, label: shortName(group.property) });
      }),
    ),
  );
  return addToGraph(graph, nodes, links);
}

/** Replaces the node - e.g. after its details are known. */
export function updateNode(graph: Graph, node: GraphNode): Graph {
  if (!graph.nodes.has(node.id)) {
    return graph;
  }
  const nodes = new Map(graph.nodes);
  nodes.set(node.id, merge(nodes.get(node.id), node));
  return { nodes, links: graph.links };
}

/** Removes the nodes (and their links). */
export function removeNodes(graph: Graph, ids: Iterable<string>): Graph {
  const removed = new Set(ids);
  if (removed.size === 0) {
    return graph;
  }
  const nodes = new Map([...graph.nodes].filter(([id]) => !removed.has(id)));
  const links = new Map([...graph.links].filter(([, l]) => !removed.has(l.source) && !removed.has(l.target)));
  return { nodes, links };
}

/** The graph without the nodes of the hidden types (and the links to them). */
export function filterGraph(graph: Graph, hiddenTypes: ReadonlySet<string>): Graph {
  if (hiddenTypes.size === 0) {
    return graph;
  }
  return removeNodes(
    graph,
    [...graph.nodes.values()].filter((n) => hiddenTypes.has(n.type)).map((n) => n.id),
  );
}

export interface Degrees {
  in: number;
  out: number;
}

/** The number of incoming and outgoing links per node. */
export function degrees(graph: Graph): Map<string, Degrees> {
  const result = new Map<string, Degrees>();
  graph.nodes.forEach((_, id) => result.set(id, { in: 0, out: 0 }));
  graph.links.forEach((link) => {
    const source = result.get(link.source);
    const target = result.get(link.target);
    if (source) source.out++;
    if (target) target.in++;
  });
  return result;
}

export interface TypeSummary {
  type: string;
  color: string;
  count: number;
}

/** The types in the graph - the most frequent first. */
export function typeSummaries(graph: Graph): TypeSummary[] {
  const summaries = new Map<string, TypeSummary>();
  graph.nodes.forEach((node) => {
    if (node.status !== "resolved") {
      return;
    }
    const summary = summaries.get(node.type) ?? { type: node.type, color: node.color, count: 0 };
    summary.count++;
    summaries.set(node.type, summary);
  });
  return [...summaries.values()].sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

/** The chip which sums up the type filter. */
export interface TypePill {
  label: string;
  value: string;
  /** The types which are shown, for the hover text */
  title: string;
}

/** How many names the hover text of the type chip lists before it says how many more there are. */
const PILL_NAMES = 12;

/**
 * One chip, always in the same form, always about what is shown (as the checkboxes of the types are): "4 of 50 types".
 * There is none while every type is shown. Mixing "shown" and "hidden" depending on which list is shorter was
 * confusing - the same filter has to read the same way, whatever its size.
 */
export function typePill(types: TypeSummary[], hidden: ReadonlySet<string>): TypePill | undefined {
  const shown = types.filter((t) => !hidden.has(t.type));
  if (shown.length === types.length) {
    return undefined;
  }
  const names = shown.slice(0, PILL_NAMES).map((t) => t.type);
  const more = shown.length - names.length;
  return {
    label: "Types",
    value: `${shown.length} of ${types.length} shown`,
    title: shown.length === 0 ? "No type is shown" : `Shown: ${names.join(", ")}${more > 0 ? ` and ${more} more` : ""}`,
  };
}

export interface Neighbour {
  node: GraphNode;
  /** Whether the node links to the neighbour (otherwise the neighbour links to it) */
  outgoing: boolean;
  labels: string[];
}

/** The nodes linked with the node (in either direction) - the same node can be both. */
export function neighboursOf(graph: Graph, id: string): Neighbour[] {
  const result: Neighbour[] = [];
  graph.links.forEach((link) => {
    const outgoing = link.source === id;
    if (!outgoing && link.target !== id) {
      return;
    }
    const node = graph.nodes.get(outgoing ? link.target : link.source);
    if (node) {
      result.push({ node, outgoing, labels: link.labels });
    }
  });
  return result;
}

/** Hops from the node to every node it reaches (links followed in either direction). */
export function hopsFrom(graph: Graph, start: string | undefined): Map<string, number> {
  const hops = new Map<string, number>();
  if (!start || !graph.nodes.has(start)) {
    return hops;
  }
  const adjacency = new Map<string, string[]>();
  const connect = (from: string, to: string) => {
    const list = adjacency.get(from);
    if (list) {
      list.push(to);
    } else {
      adjacency.set(from, [to]);
    }
  };
  graph.links.forEach((link) => {
    connect(link.source, link.target);
    connect(link.target, link.source);
  });
  hops.set(start, 0);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    (adjacency.get(current) ?? []).forEach((next) => {
      if (!hops.has(next)) {
        hops.set(next, hops.get(current)! + 1);
        queue.push(next);
      }
    });
  }
  return hops;
}
