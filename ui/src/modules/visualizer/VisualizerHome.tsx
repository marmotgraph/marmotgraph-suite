import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, CircleDot, Hexagon, Maximize, Network, Orbit, Sparkles, Trash, ZoomIn, ZoomOut } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { SearchBar } from "../../components/SearchBar";
import { FilterPill } from "../../components/FilterPill";
import { MOBILE_VIEWPORT_QUERY, useMediaQuery } from "../../hooks/useMediaQuery";
import { useTypes } from "../../hooks/useTypes";
import { typeLabel } from "../../services/types";
import {
  appendIncomingLinks,
  fetchIncomingLinks,
  fetchInstance,
  fetchInstances,
  IncomingLinks,
} from "../../services/instances";
import type { InstanceSummary } from "../editor/editorMockData";
import GraphCanvas, { CanvasLink, CanvasNode, GraphCanvasHandle } from "./GraphCanvas";
import NodePanel from "./NodePanel";
import TypeFilter, { SEARCH_FROM } from "./TypeFilter";
import {
  addDetail,
  addIncoming,
  addToGraph,
  degrees as degreesOf,
  EMPTY_GRAPH,
  filterGraph,
  Graph,
  GraphNode,
  hopsFrom,
  nodeOfDetail,
  nodeOfLink,
  removeNodes,
  typeColorOf,
  typePill,
  typeSummaries,
  updateNode,
} from "./graphModel";
import { HIVE_AXIS_LABELS, HIVE_RANK_LABELS, HiveAxisBy, HiveOptions, HiveRankBy, LayoutKind } from "./layouts";
import "./Visualizer.css";

/** The most links of an instance added at once - a hub would bury the graph otherwise. */
const MAX_OUTGOING = 60;
/** The most instances expanded by "Expand all" at once. */
const MAX_EXPAND_ALL = 24;

/** The label of "expand all" - how many of the instances not expanded yet are expanded by a click */
function expandAllLabel(count: number): string {
  if (count === 0) {
    return "Nothing left to expand";
  }
  const total = count > MAX_EXPAND_ALL ? ` of ${count}` : "";
  return `Expand ${Math.min(count, MAX_EXPAND_ALL)}${total} ${count === 1 ? "instance" : "instances"}`;
}
const PARALLEL_REQUESTS = 4;
const STORAGE_KEY = "marmotgraph.visualizer";

const LAYOUTS: { kind: LayoutKind; label: string; hint: string; icon: React.ReactNode }[] = [
  { kind: "network", label: "Network", hint: "Live force-directed network - drag nodes around", icon: <Network size={16} /> },
  { kind: "hive", label: "Hive plot", hint: "Nodes on axes by group, placed by a measure - dense networks stay readable", icon: <Hexagon size={16} /> },
  { kind: "radial", label: "Radial", hint: "Rings of links around the selected instance", icon: <Orbit size={16} /> },
  { kind: "circle", label: "Circular", hint: "Nodes on a circle by type, links through the middle", icon: <CircleDot size={16} /> },
];

interface Stored {
  nodes: GraphNode[];
  links: { source: string; target: string; labels: string[] }[];
  layout: LayoutKind;
  hive: HiveOptions;
  selected?: string;
}

function restore(): Stored | undefined {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : undefined;
  } catch {
    return undefined;
  }
}

function toGraph(stored: Stored | undefined): Graph {
  if (!stored) {
    return EMPTY_GRAPH;
  }
  let graph = addToGraph(EMPTY_GRAPH, stored.nodes, []);
  stored.links.forEach((link) => {
    graph = addToGraph(graph, [], link.labels.length ? link.labels.map((label) => ({ ...link, label })) : [link]);
  });
  return graph;
}

function summaryNode(summary: InstanceSummary): GraphNode {
  return {
    ...nodeOfLink({
      instanceId: summary.instanceId,
      instanceName: summary.instanceName,
      type: summary.type,
      typeColor: summary.typeColor,
      space: summary.space,
    }),
    releaseStatus: summary.releaseStatus,
    contributed: summary.contributed,
  };
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The unloaded incoming links - at least one for a type with a next page whose total is unknown. */
function pendingIncomingOf(groups: IncomingLinks[] | undefined): number {
  return (groups ?? []).reduce(
    (sum, group) =>
      sum +
      group.types.reduce((n, type) => {
        if (!type.nextMarker) return n;
        return n + (type.total !== undefined ? Math.max(0, type.total - type.links.length) : 1);
      }, 0),
    0,
  );
}

/**
 * Visual exploration of the graph: start with an instance (or a type), then follow the links. The same graph can be
 * read as a network, a hive plot, rings around a focus, or a circle - whatever shows its structure best. The
 * instances are loaded on demand since the core only knows the links per instance.
 */
export default function VisualizerHome() {
  const { getAccessToken } = useAuth();
  const isMobile = useMediaQuery(MOBILE_VIEWPORT_QUERY);
  const knownTypes = useTypes();
  const [searchParams, setSearchParams] = useSearchParams();
  const canvasRef = useRef<GraphCanvasHandle>(null);

  const [stored] = useState(restore);
  const [graph, setGraph] = useState<Graph>(() => toGraph(stored));
  const [selectedId, setSelectedId] = useState<string | undefined>(stored?.selected);
  const [layout, setLayout] = useState<LayoutKind>(stored?.layout ?? "network");
  const [hive, setHive] = useState<HiveOptions>(stored?.hive ?? { axisBy: "type", rankBy: "connections" });
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<string>>(new Set());
  const [showLabels, setShowLabels] = useState(true);
  const [showLinkLabels, setShowLinkLabels] = useState(false);
  const [showArrows, setShowArrows] = useState(true);
  const [panelOpen, setPanelOpen] = useState(() => !isMobile);

  const [expanding, setExpanding] = useState<ReadonlySet<string>>(new Set());
  const [loadingDetail, setLoadingDetail] = useState<ReadonlySet<string>>(new Set());
  const [incoming, setIncoming] = useState<ReadonlyMap<string, IncomingLinks[]>>(new Map());
  const [loadingBulk, setLoadingBulk] = useState(false);
  /** While "Expand" runs: how many of the instances are done, and what the graph looked like before */
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number }>();
  const bulkBefore = useRef<{ nodes: number; links: number; expanded: number }>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [confirmClear, setConfirmClear] = useState(false);

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<InstanceSummary[]>();
  const [searching, setSearching] = useState(false);

  const graphRef = useRef(graph);
  graphRef.current = graph;
  const requested = useRef(new Set<string>());

  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timer = window.setTimeout(() => setNotice(undefined), 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Survives a visit to the editor - the exploration is kept for the browser tab
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const snapshot: Stored = {
          nodes: [...graph.nodes.values()],
          links: [...graph.links.values()].map(({ source, target, labels }) => ({ source, target, labels })),
          layout,
          hive,
          selected: selectedId,
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // The graph is too big to keep - it is only lost when leaving
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [graph, layout, hive, selectedId]);

  const visible = useMemo(() => filterGraph(graph, hiddenTypes), [graph, hiddenTypes]);
  const degrees = useMemo(() => degreesOf(visible), [visible]);
  const types = useMemo(() => typeSummaries(graph), [graph]);
  const effectiveSelected = selectedId && visible.nodes.has(selectedId) ? selectedId : undefined;
  const hops = useMemo(() => hopsFrom(visible, effectiveSelected), [visible, effectiveSelected]);

  const canvasNodes = useMemo<CanvasNode[]>(
    () =>
      [...visible.nodes.values()].map((node) => {
        const d = degrees.get(node.id) ?? { in: 0, out: 0 };
        return {
          id: node.id,
          name: node.name,
          type: node.type,
          color: node.color,
          space: node.space,
          releaseStatus: node.releaseStatus,
          radius: 9 + Math.min(15, Math.sqrt(d.in + d.out) * 3.2),
          in: d.in,
          out: d.out,
          initial: node.status === "resolved" ? (node.type.match(/[a-z0-9]/i)?.[0] ?? "?").toUpperCase() : "?",
          status: node.status,
          expandable: node.status === "resolved" && !node.expanded && (node.hasDirectLinks !== false || node.hasReverseLinks !== false),
        };
      }),
    [visible, degrees],
  );
  const canvasLinks = useMemo<CanvasLink[]>(
    () =>
      [...visible.links.values()].map((link) => ({
        id: link.id,
        source: link.source,
        target: link.target,
        labels: link.labels,
        curved: visible.links.has(`${link.target}>${link.source}`),
      })),
    [visible],
  );

  const selectedNode = effectiveSelected ? visible.nodes.get(effectiveSelected) : undefined;
  const expandableCount = canvasNodes.filter((n) => n.expandable).length;

  // ---- Loading ----

  const withBusy = useCallback(
    async <T,>(set: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>, id: string, work: () => Promise<T>): Promise<T | undefined> => {
      set((current) => new Set(current).add(id));
      try {
        return await work();
      } catch (e) {
        console.error("The graph could not be loaded", e);
        setError(errorMessage(e));
        return undefined;
      } finally {
        set((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    },
    [],
  );

  const expand = useCallback(
    (id: string) =>
      withBusy(setExpanding, id, async () => {
        const token = await getAccessToken();
        const [detail, links] = await Promise.all([fetchInstance(token, id), fetchIncomingLinks(token, id).catch((): IncomingLinks[] => [])]);
        const omitted = Math.max(0, (detail.directLinks?.length ?? 0) - MAX_OUTGOING);
        setGraph((current) => addIncoming(addDetail(current, detail, MAX_OUTGOING).graph, id, links));
        setIncoming((current) => new Map(current).set(id, links));
        if (omitted > 0) {
          setNotice(`${detail.instanceName} links to ${detail.directLinks!.length} instances - the first ${MAX_OUTGOING} are shown.`);
        }
      }),
    [getAccessToken, withBusy],
  );

  const loadMoreIncoming = useCallback(
    (id: string) =>
      withBusy(setExpanding, id, async () => {
        const token = await getAccessToken();
        let groups = incoming.get(id) ?? [];
        for (const group of groups) {
          for (const type of group.types) {
            if (type.nextMarker && (type.total === undefined || type.links.length < type.total)) {
              const page = await fetchIncomingLinks(token, id, type.nextMarker);
              groups = appendIncomingLinks(groups, group.property, type.typeIdentifier, page);
            }
          }
        }
        setIncoming((current) => new Map(current).set(id, groups));
        setGraph((current) => addIncoming(current, id, groups));
      }),
    [getAccessToken, incoming, withBusy],
  );

  const select = useCallback(
    (id: string | undefined) => {
      setSelectedId(id);
      const node = id ? graphRef.current.nodes.get(id) : undefined;
      if (!id || !node || node.status !== "resolved" || node.properties || requested.current.has(id)) {
        return;
      }
      requested.current.add(id);
      withBusy(setLoadingDetail, id, async () => {
        const detail = await fetchInstance(await getAccessToken(), id);
        setGraph((current) => updateNode(current, nodeOfDetail(detail, false)));
      });
    },
    [getAccessToken, withBusy],
  );

  /** Adds an instance, selects it and loads its links. */
  const focusOn = useCallback(
    (node: GraphNode) => {
      setGraph((current) => addToGraph(current, [node], []));
      select(node.id);
      expand(node.id);
    },
    [expand, select],
  );

  const runSearch = useCallback(async () => {
    if (!term.trim()) {
      setResults(undefined);
      return;
    }
    setSearching(true);
    setError(undefined);
    try {
      const list = await fetchInstances(await getAccessToken(), { search: term });
      setResults(list.instances);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSearching(false);
    }
  }, [getAccessToken, term]);

  const addSample = useCallback(
    async (typeIdentifier: string) => {
      if (!typeIdentifier) {
        return;
      }
      setLoadingBulk(true);
      setError(undefined);
      try {
        const list = await fetchInstances(await getAccessToken(), { types: [typeIdentifier] });
        const nodes = list.instances.map(summaryNode);
        setGraph((current) => addToGraph(current, nodes, []));
        const label = knownTypes.find((t) => t.identifier === typeIdentifier);
        const name = label ? typeLabel(label) : "this type";
        setNotice(
          list.total && list.total > nodes.length
            ? `Added ${nodes.length} of ${list.total} instances of ${name}. Search for others to add them.`
            : `Added ${nodes.length} instance${nodes.length === 1 ? "" : "s"} of ${name}.`,
        );
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoadingBulk(false);
      }
    },
    [getAccessToken, knownTypes],
  );

  /** Loads the links of the instances which have not been expanded yet - one step further out. */
  const expandAll = useCallback(async () => {
    const queue = canvasNodes.filter((n) => n.expandable).map((n) => n.id);
    const batch = queue.slice(0, MAX_EXPAND_ALL);
    bulkBefore.current = { nodes: graphRef.current.nodes.size, links: graphRef.current.links.size, expanded: batch.length };
    setBulkProgress({ done: 0, total: batch.length });
    setLoadingBulk(true);
    const workers = Array.from({ length: PARALLEL_REQUESTS }, async () => {
      for (let id = batch.shift(); id; id = batch.shift()) {
        await expand(id);
        setBulkProgress((current) => current && { ...current, done: current.done + 1 });
      }
    });
    await Promise.all(workers);
    setLoadingBulk(false);
    setBulkProgress(undefined);
  }, [canvasNodes, expand]);

  // Says what "Expand" did, once the graph has caught up with the answers
  const expandableNow = useRef(0);
  expandableNow.current = expandableCount;
  useEffect(() => {
    const before = bulkBefore.current;
    if (loadingBulk || !before) {
      return;
    }
    bulkBefore.current = undefined;
    const nodes = graphRef.current.nodes.size - before.nodes;
    const links = graphRef.current.links.size - before.links;
    const more = expandableNow.current;
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    setNotice(
      `Expanded ${plural(before.expanded, "instance")}: ${nodes > 0 ? `${plural(nodes, "new instance")}` : "no new instances"}, ${plural(Math.max(0, links), "new link")}.` +
        (more > 0 ? ` ${plural(more, "instance")} can be expanded further - expand again to go one step further.` : " Everything shown is expanded."),
    );
  }, [loadingBulk]);

  // Opened with an instance (?instance=<id>), e.g. from a link
  const seeded = useRef(false);
  useEffect(() => {
    const instanceId = searchParams.get("instance");
    if (!instanceId || seeded.current) {
      return;
    }
    seeded.current = true;
    setSearchParams({}, { replace: true });
    withBusy(setExpanding, instanceId, async () => {
      const detail = await fetchInstance(await getAccessToken(), instanceId);
      focusOn(nodeOfDetail(detail, false));
    });
  }, [searchParams, setSearchParams, getAccessToken, focusOn, withBusy]);

  // ---- Actions on the graph ----

  const removeSelected = (id: string) => {
    setGraph((current) => removeNodes(current, [id]));
    setSelectedId(undefined);
  };

  const clear = () => {
    setGraph(EMPTY_GRAPH);
    setSelectedId(undefined);
    setIncoming(new Map());
    setHiddenTypes(new Set());
    requested.current.clear();
    setConfirmClear(false);
  };

  const setTypesVisible = (names: string[], shown: boolean) =>
    setHiddenTypes((current) => {
      const next = new Set(current);
      names.forEach((name) => (shown ? next.delete(name) : next.add(name)));
      return next;
    });

  const toggleType = (type: string) =>
    setHiddenTypes((current) => {
      const next = new Set(current);
      if (!next.delete(type)) {
        next.add(type);
      }
      return next;
    });

  const hasGraph = graph.nodes.size > 0;
  const typeChip = useMemo(() => typePill(types, hiddenTypes), [types, hiddenTypes]);
  const sampleTypes = useMemo(
    () => [...knownTypes].map((t) => ({ identifier: t.identifier, name: typeLabel(t), color: typeColorOf(typeLabel(t), t.color) })).sort((a, b) => a.name.localeCompare(b.name)),
    [knownTypes],
  );
  const [sampleTerm, setSampleTerm] = useState("");
  const shownSampleTypes = useMemo(() => {
    const query = sampleTerm.trim().toLowerCase();
    return query ? sampleTypes.filter((t) => t.name.toLowerCase().includes(query)) : sampleTypes;
  }, [sampleTypes, sampleTerm]);

  return (
    <div className="viz-home">
      <div className={`viz-toolbar${layout === "hive" ? " viz-toolbar--hive" : ""}`}>
        <div className="viz-toolbar-start">
          <div className="viz-search">
            <SearchBar
              value={term}
              onChange={(value) => {
                setTerm(value);
                if (!value) setResults(undefined);
              }}
              onSearch={runSearch}
              placeholder="Find an instance to start from"
              ariaLabel="Find an instance to add to the graph"
            />
            {(searching || results) && (
              <div className="viz-results" role="listbox" aria-label="Search results" onKeyDown={(e) => e.key === "Escape" && setResults(undefined)}>
                {searching ? (
                  <div className="viz-results-empty">
                    <Spinner animation="border" size="sm" role="status" className="me-2" />
                    Searching...
                  </div>
                ) : results?.length === 0 ? (
                  <div className="viz-results-empty">No instances found.</div>
                ) : (
                  results?.slice(0, 8).map((summary) => (
                    <button
                      key={summary.instanceId}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="viz-result"
                      onClick={() => {
                        focusOn(summaryNode(summary));
                        setResults(undefined);
                        setTerm("");
                      }}
                    >
                      <span className="viz-dot" style={{ background: typeColorOf(summary.type, summary.typeColor) }} aria-hidden="true" />
                      <span className="viz-result-type">{summary.type}</span>
                      <span className="viz-result-name">{summary.instanceName}</span>
                      <code className="viz-result-id">{summary.instanceId}</code>
                      <span className="viz-result-space">{summary.space}</span>
                    </button>
                  ))
                )}
                {!!results?.length && (
                  <button type="button" className="viz-results-close" onClick={() => setResults(undefined)}>
                    Close results
                  </button>
                )}
              </div>
            )}
          </div>

          {hasGraph && (
            <span className="viz-count-chip">
              {visible.nodes.size} instance{visible.nodes.size === 1 ? "" : "s"} · {visible.links.size} link{visible.links.size === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="viz-toolbar-end">
          {layout === "hive" && (
            <div className="viz-hive-options" aria-label="Hive plot options">
              <label>
                <span className="viz-kicker">Axes by</span>
                <Form.Select value={hive.axisBy} onChange={(e) => setHive({ ...hive, axisBy: e.target.value as HiveAxisBy })}>
                  {(Object.keys(HIVE_AXIS_LABELS) as HiveAxisBy[]).map((key) => (
                    <option key={key} value={key}>
                      {HIVE_AXIS_LABELS[key]}
                    </option>
                  ))}
                </Form.Select>
              </label>
              <label>
                <span className="viz-kicker">Position by</span>
                <Form.Select value={hive.rankBy} onChange={(e) => setHive({ ...hive, rankBy: e.target.value as HiveRankBy })}>
                  {(Object.keys(HIVE_RANK_LABELS) as HiveRankBy[]).map((key) => (
                    <option key={key} value={key}>
                      {HIVE_RANK_LABELS[key]}
                    </option>
                  ))}
                </Form.Select>
              </label>
            </div>
          )}

          <div className="viz-layouts" role="radiogroup" aria-label="Representation">
            {LAYOUTS.map((option) => (
              <button
                key={option.kind}
                type="button"
                role="radio"
                aria-checked={layout === option.kind}
                className={`viz-layout-option${layout === option.kind ? " active" : ""}`}
                title={option.hint}
                aria-label={option.label}
                onClick={() => setLayout(option.kind)}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)} className="mb-2 py-2">
          {error}
        </Alert>
      )}

      <div className={`viz-stage${panelOpen ? "" : " viz-stage--panel-closed"}${selectedNode ? " viz-stage--detail" : ""}`}>
        {panelOpen ? (
          <aside className="viz-side" aria-label="Graph settings">
            <div className="viz-side-header">
              <h2 className="viz-kicker">Graph</h2>
              <Button variant="link" size="sm" className="edit-icon-btn" onClick={() => setPanelOpen(false)} aria-label="Collapse panel" title="Collapse panel">
                <ChevronLeft size={16} />
              </Button>
            </div>
            <div className="viz-summary" aria-live="polite">
              <div>
                <strong>{visible.nodes.size}</strong>
                <span>instances</span>
              </div>
              <div>
                <strong>{visible.links.size}</strong>
                <span>links</span>
              </div>
            </div>

            <section className="viz-section viz-expand" aria-label="Expand">
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={expandableCount === 0 || loadingBulk}
                onClick={expandAll}
                aria-describedby="viz-expand-hint"
              >
                {loadingBulk ? <Spinner animation="border" size="sm" className="me-2" /> : <Sparkles size={14} className="me-2" />}
                {loadingBulk && bulkProgress
                  ? `Expanding ${bulkProgress.done} of ${bulkProgress.total}...`
                  : expandAllLabel(expandableCount)}
              </Button>
              <p id="viz-expand-hint" className="viz-hint">
                Loads the links of the instances not expanded yet (they carry a small badge). Each click goes one step further out.
              </p>
            </section>

            <section className="viz-section" aria-label="Types">
              <h3 className="viz-kicker">Types ({types.length})</h3>
              <TypeFilter types={types} hidden={hiddenTypes} onToggle={toggleType} onSetVisible={setTypesVisible} />
            </section>

            <section className="viz-section" aria-label="Display">
              <h3 className="viz-kicker">Display</h3>
              <Form.Check type="switch" id="viz-labels" label="Names" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
              <Form.Check type="switch" id="viz-link-labels" label="Link names" checked={showLinkLabels} onChange={(e) => setShowLinkLabels(e.target.checked)} />
              <Form.Check type="switch" id="viz-arrows" label="Direction" checked={showArrows} onChange={(e) => setShowArrows(e.target.checked)} />
            </section>

            <div className="viz-side-footer">
              <Button variant="link" size="sm" className="viz-quiet" disabled={!hasGraph} onClick={() => setConfirmClear(true)}>
                <Trash size={14} className="me-2" />
                Clear graph
              </Button>
            </div>
          </aside>
        ) : (
          <Button variant="link" className="edit-icon-btn viz-side-toggle" onClick={() => setPanelOpen(true)} aria-label="Show graph settings" title="Show graph settings">
            <ChevronRight size={16} />
          </Button>
        )}

        <div className="viz-main">
          {typeChip && (
            <div className="viz-pills">
              <FilterPill label={typeChip.label} value={typeChip.value} title={typeChip.title} onRemove={() => setHiddenTypes(new Set())} />
            </div>
          )}

          {hasGraph && visible.nodes.size === 0 && (
            <div className="viz-empty viz-empty--over" role="status">
              <div className="viz-empty-card">
                <h2>Every type is hidden</h2>
                <p>Nothing is left to show. Bring the types back to see the graph again.</p>
                <Button variant="outline-secondary" size="sm" onClick={() => setHiddenTypes(new Set())}>
                  Show all types
                </Button>
              </div>
            </div>
          )}

          {hasGraph ? (
            <GraphCanvas
              ref={canvasRef}
              nodes={canvasNodes}
              links={canvasLinks}
              layout={layout}
              hive={hive}
              hops={hops}
              selectedId={effectiveSelected}
              showLabels={showLabels}
              showLinkLabels={showLinkLabels}
              showArrows={showArrows}
              onSelect={select}
              onExpand={expand}
            />
          ) : (
            <div className="viz-empty">
              <div className="viz-empty-card">
                <div className="viz-empty-mark" aria-hidden="true">
                  <Network size={28} />
                </div>
                <h2>Explore the graph</h2>
                <p>Search for an instance to start from, then follow its links. Switch the representation any time - the hive plot keeps dense networks readable.</p>
                {sampleTypes.length > 0 && (
                  <>
                    <div className="viz-kicker">Or start with a type</div>
                    {sampleTypes.length >= SEARCH_FROM && (
                      <Form.Control
                        type="search"
                        size="sm"
                        className="viz-chips-filter"
                        value={sampleTerm}
                        placeholder="Filter types"
                        aria-label={`Filter the ${sampleTypes.length} types`}
                        onChange={(e) => setSampleTerm(e.target.value)}
                      />
                    )}
                    <div className="viz-chips">
                      {shownSampleTypes.length === 0 && <p className="viz-muted">No type matches.</p>}
                      {shownSampleTypes.map((type) => (
                        <button key={type.identifier} type="button" className="viz-chip" onClick={() => addSample(type.identifier)} disabled={loadingBulk}>
                          <span className="viz-dot" style={{ background: type.color }} aria-hidden="true" />
                          {type.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {hasGraph && (
            <div className="viz-tools">
              <Button variant="link" className="edit-icon-btn" onClick={() => canvasRef.current?.zoomBy(1.4)} aria-label="Zoom in" title="Zoom in">
                <ZoomIn size={16} />
              </Button>
              <Button variant="link" className="edit-icon-btn" onClick={() => canvasRef.current?.zoomBy(1 / 1.4)} aria-label="Zoom out" title="Zoom out">
                <ZoomOut size={16} />
              </Button>
              <Button variant="link" className="edit-icon-btn" onClick={() => canvasRef.current?.fit()} aria-label="Fit to view" title="Fit to view">
                <Maximize size={16} />
              </Button>
            </div>
          )}

          {(expanding.size > 0 || loadingBulk) && (
            <output className="viz-busy">
              <Spinner as="span" animation="border" size="sm" className="me-2" />
              Loading links...
            </output>
          )}
          {notice && (
            <output className="viz-notice">
              {notice}
              <Button variant="link" size="sm" className="viz-notice-close" onClick={() => setNotice(undefined)} aria-label="Dismiss">
                ×
              </Button>
            </output>
          )}
        </div>

        {selectedNode && (
          <NodePanel
            graph={visible}
            node={selectedNode}
            degree={degrees.get(selectedNode.id)}
            loading={loadingDetail.has(selectedNode.id)}
            expanding={expanding.has(selectedNode.id)}
            pendingIncoming={pendingIncomingOf(incoming.get(selectedNode.id))}
            onSelect={select}
            onExpand={expand}
            onLoadMoreIncoming={loadMoreIncoming}
            onRemove={removeSelected}
            onClose={() => setSelectedId(undefined)}
          />
        )}
      </div>

      <Modal show={confirmClear} onHide={() => setConfirmClear(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Clear the graph?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          This removes all {graph.nodes.size} instances from the view. Nothing is deleted - you can add them again.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setConfirmClear(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={clear}>
            Clear graph
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
