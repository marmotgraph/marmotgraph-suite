import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Col, Form, Row } from "react-bootstrap";
import { Link, useSearchParams } from "react-router-dom";
import { Maximize, Pencil, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { ModelType, relations, Relation, shortName, typeName } from "../../services/modeler";
import type { ModelerContext } from "./ModelerHome";
import { drag } from "d3-drag";
import { select } from "d3-selection";
import { D3ZoomEvent, zoom, zoomIdentity, ZoomTransform } from "d3-zoom";
import { layoutGraph, Point } from "./graphLayout";
import { loadPositions, savePositions } from "./nodePositions";
import TypeIdentifier from "./TypeIdentifier";

interface GraphNode {
  identifier: string;
  label: string;
  color: string;
  radius: number;
  /** The type is linked to but not part of the model (e.g. not visible to the user) */
  external: boolean;
}

/** The relations between two types (in one direction) - drawn as one edge. */
interface GraphEdge {
  source: string;
  target: string;
  labels: string[];
}

interface Size {
  width: number;
  height: number;
}

const DEFAULT_COLOR = "#6c757d";
const PADDING = 40;
/** Small graphs are not blown up beyond this scale when fitted to the view. */
const MAX_FIT_SCALE = 1.5;

function nodeRadius(type?: ModelType) {
  return 12 + Math.min(14, Math.log10((type?.occurrences ?? 0) + 1) * 4);
}

/** The relations grouped by source and target. */
function edgesOf(rels: Relation[]): GraphEdge[] {
  const edges = new Map<string, GraphEdge>();
  rels.forEach((relation) => {
    const key = `${relation.source}\n${relation.target}`;
    const edge = edges.get(key) ?? { source: relation.source, target: relation.target, labels: [] };
    if (!edge.labels.includes(relation.label)) {
      edge.labels.push(relation.label);
    }
    edges.set(key, edge);
  });
  return [...edges.values()];
}

/** The size of the element - a default if it isn't laid out (yet). */
function sizeOf(element: Element | null): Size {
  const rect = element?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? { width: rect.width, height: rect.height } : { width: 800, height: 600 };
}

/** The zoom transform showing all the given nodes in an element of the given size. */
function fit(positions: Map<string, Point>, nodes: GraphNode[], size: Size): ZoomTransform {
  if (nodes.length === 0) {
    return zoomIdentity.translate(size.width / 2, size.height / 2);
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((node) => {
    const p = positions.get(node.identifier)!;
    minX = Math.min(minX, p.x - node.radius);
    maxX = Math.max(maxX, p.x + node.radius);
    minY = Math.min(minY, p.y - node.radius);
    // The label is shown below the node
    maxY = Math.max(maxY, p.y + node.radius + 20);
  });
  const scale = Math.min(MAX_FIT_SCALE, size.width / (maxX - minX + 2 * PADDING), size.height / (maxY - minY + 2 * PADDING));
  return zoomIdentity
    .translate(size.width / 2, size.height / 2)
    .scale(scale)
    .translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
}

/** The path of an edge - curved if there is an edge in the opposite direction, a loop if it links a type to itself. */
function edgePath(source: Point, target: Point, sourceRadius: number, targetRadius: number, curved: boolean): string {
  if (source === target) {
    const r = sourceRadius;
    return `M ${source.x - r * 0.5} ${source.y - r * 0.85} C ${source.x - r * 2} ${source.y - r * 4}, ${source.x + r * 2} ${source.y - r * 4}, ${source.x + r * 0.5} ${source.y - r * 0.85}`;
  }
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const ux = dx / distance;
  const uy = dy / distance;
  const start = { x: source.x + ux * sourceRadius, y: source.y + uy * sourceRadius };
  const end = { x: target.x - ux * (targetRadius + 4), y: target.y - uy * (targetRadius + 4) };
  if (!curved) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
  const bend = Math.min(40, distance / 4);
  const control = { x: (start.x + end.x) / 2 - uy * bend, y: (start.y + end.y) / 2 + ux * bend };
  return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
}

function labelPosition(source: Point, target: Point, radius: number, curved: boolean): Point {
  if (source === target) {
    return { x: source.x, y: source.y - radius * 3.2 };
  }
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const bend = curved ? Math.min(40, distance / 4) / 2 : 0;
  return { x: (source.x + target.x) / 2 - (dy / distance) * bend, y: (source.y + target.y) / 2 + (dx / distance) * bend };
}

/** Shows the types as nodes and their relations as edges - the selected type is highlighted with its neighbours. */
export default function TypeGraph({ types }: ModelerContext) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get("type") ?? undefined;
  const [filter, setFilter] = useState("");
  const [neighboursOnly, setNeighboursOnly] = useState(false);
  const [hideUnrelated, setHideUnrelated] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [hovered, setHovered] = useState<string>();

  const allRelations = useMemo(() => relations(types), [types]);
  const allEdges = useMemo(() => edgesOf(allRelations), [allRelations]);
  const allNodes = useMemo(() => {
    const nodes = new Map<string, GraphNode>();
    types.forEach((type) =>
      nodes.set(type.identifier, {
        identifier: type.identifier,
        label: typeName(type),
        color: type.color || DEFAULT_COLOR,
        radius: nodeRadius(type),
        external: false,
      }),
    );
    allEdges.forEach((edge) => {
      if (!nodes.has(edge.target)) {
        nodes.set(edge.target, { identifier: edge.target, label: shortName(edge.target), color: DEFAULT_COLOR, radius: nodeRadius(), external: true });
      }
    });
    return nodes;
  }, [types, allEdges]);

  const neighbours = useMemo(() => {
    const result = new Set<string>();
    if (selected) {
      result.add(selected);
      allEdges.forEach((edge) => {
        if (edge.source === selected) result.add(edge.target);
        if (edge.target === selected) result.add(edge.source);
      });
    }
    return result;
  }, [allEdges, selected]);

  const nodes = useMemo(() => {
    const related = new Set(allEdges.flatMap((edge) => [edge.source, edge.target]));
    return [...allNodes.values()].filter(
      (node) =>
        (!neighboursOnly || !selected || neighbours.has(node.identifier)) &&
        (!hideUnrelated || related.has(node.identifier) || node.identifier === selected),
    );
  }, [allNodes, allEdges, neighboursOnly, hideUnrelated, selected, neighbours]);
  const nodeIds = useMemo(() => new Set(nodes.map((node) => node.identifier)), [nodes]);
  const edges = useMemo(() => allEdges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)), [allEdges, nodeIds]);

  // The positions the user arranged the types at - they are kept, only the other types are laid out (around them)
  const [arranged, setArranged] = useState<Map<string, Point>>(loadPositions);
  const layout = useMemo(() => layoutGraph(nodes, edges, arranged), [nodes, edges, arranged]);
  // The node currently dragged by the user - its position is only stored when it is dropped
  const [dragged, setDragged] = useState<{ node: string; position: Point }>();
  const position = (identifier: string) => (dragged?.node === identifier ? dragged.position : layout.get(identifier)!);

  /**
   * Keeps the node where it was dropped. All other shown nodes are fixed at their current position as well - otherwise
   * they would be laid out again around the dropped node.
   */
  const drop = (node: string, point: Point) => {
    const positions = new Map(arranged);
    nodes.forEach((n) => positions.set(n.identifier, layout.get(n.identifier)!));
    positions.set(node, point);
    setArranged(savePositions(positions));
  };

  const svgRef = useRef<SVGSVGElement>(null);
  // Pan and zoom are handled by d3 - the resulting transform is applied to the content of the graph
  const zoomBehavior = useMemo(
    () =>
      zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.05, 4])
        .extent(function () {
          const { width, height } = sizeOf(this);
          return [
            [0, 0],
            [width, height],
          ];
        }),
    [],
  );
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  useEffect(() => {
    const svg = select(svgRef.current!);
    zoomBehavior.on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => setTransform(event.transform));
    svg.call(zoomBehavior);
    return () => {
      svg.on(".zoom", null);
    };
  }, [zoomBehavior]);

  // The handlers registered with d3 always need to see the current state
  const latest = useRef({ layout, drop });
  latest.current = { layout, drop };

  const fitView = () => select(svgRef.current!).call(zoomBehavior.transform, fit(latest.current.layout, nodes, sizeOf(svgRef.current)));
  const zoomBy = (factor: number) => select(svgRef.current!).call(zoomBehavior.scaleBy, factor);
  // The view is fitted when other types are shown (or on request) - not when a node is moved
  const [fitRequest, setFitRequest] = useState(0);
  const fitRef = useRef(fitView);
  fitRef.current = fitView;
  useEffect(() => {
    fitRef.current();
  }, [nodes, fitRequest]);

  const resetArrangement = () => {
    savePositions(new Map());
    setArranged(new Map());
    setFitRequest((request) => request + 1);
  };

  // The nodes are dragged with d3 - the drag starts at the current position of the node (in the coordinates of the graph)
  useEffect(() => {
    let moved = false;
    const behavior = drag<SVGGElement, unknown>()
      .subject(function () {
        return latest.current.layout.get(this.dataset.id!)!;
      })
      .on("start", () => (moved = false))
      .on("drag", function (event) {
        moved = true;
        setDragged({ node: this.dataset.id!, position: { x: event.x, y: event.y } });
      })
      .on("end", function (event) {
        if (moved) {
          latest.current.drop(this.dataset.id!, { x: event.x, y: event.y });
        }
        setDragged(undefined);
      });
    const selection = select(svgRef.current!).selectAll<SVGGElement, unknown>("g.modeler-node").call(behavior);
    return () => {
      selection.on(".drag", null);
    };
  }, [nodes]);

  const needle = filter.trim().toLowerCase();
  const matches = (node: GraphNode) => !needle || node.label.toLowerCase().includes(needle) || node.identifier.toLowerCase().includes(needle);
  const focus = hovered ?? selected;
  const isHighlighted = (node: string) => !focus || node === focus || allEdges.some((edge) =>
    (edge.source === focus && edge.target === node) || (edge.target === focus && edge.source === node));
  const edgeKeys = useMemo(() => new Set(edges.map((edge) => `${edge.source}\n${edge.target}`)), [edges]);
  const selectedType = types.find((type) => type.identifier === selected);
  const selectedNode = selected ? allNodes.get(selected) : undefined;

  return (
    <Row>
      <Col lg={selectedNode ? 9 : 12} className="mb-3">
        <div className="d-flex flex-wrap align-items-center gap-3 mb-2">
          <Form.Control
            size="sm"
            type="search"
            className="modeler-filter"
            placeholder="Highlight types..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Highlight types"
          />
          <Form.Check
            type="switch"
            id="modeler-graph-neighbours"
            label="Only neighbours of the selection"
            disabled={!selected}
            checked={neighboursOnly}
            onChange={(e) => setNeighboursOnly(e.target.checked)}
          />
          <Form.Check
            type="switch"
            id="modeler-graph-unrelated"
            label="Hide types without relations"
            checked={hideUnrelated}
            onChange={(e) => setHideUnrelated(e.target.checked)}
          />
          <Form.Check
            type="switch"
            id="modeler-graph-labels"
            label="Relation names"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
          />
          <div className="ms-auto d-flex modeler-graph-tools">
            <Button variant="link" className="edit-icon-btn" onClick={() => zoomBy(1.3)} title="Zoom in" aria-label="Zoom in">
              <ZoomIn size={16} />
            </Button>
            <Button variant="link" className="edit-icon-btn" onClick={() => zoomBy(1 / 1.3)} title="Zoom out" aria-label="Zoom out">
              <ZoomOut size={16} />
            </Button>
            <Button variant="link" className="edit-icon-btn" onClick={() => fitView()} title="Fit to view" aria-label="Fit to view">
              <Maximize size={16} />
            </Button>
            <Button
              variant="link"
              className="edit-icon-btn"
              onClick={resetArrangement}
              disabled={arranged.size === 0}
              title="Discard the arrangement of the types and lay out the graph automatically"
              aria-label="Reset arrangement"
            >
              <RotateCcw size={16} />
            </Button>
          </div>
        </div>
        <div className="modeler-graph">
          {nodes.length === 0 && <div className="modeler-graph-empty modeler-empty">There are no types to show.</div>}
          <svg
            ref={svgRef}
            role="img"
            aria-label="Graph of the types and their relations"
            // A click on the background clears the selection (d3 suppresses the click after panning)
            onClick={() => setSearchParams({})}
          >
            <defs>
              <marker id="modeler-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="modeler-arrow" />
              </marker>
            </defs>
            <g transform={transform.toString()}>
              <g>
                {edges.map((edge) => {
                  const source = position(edge.source);
                  const target = position(edge.target);
                  const sourceNode = allNodes.get(edge.source)!;
                  const targetNode = allNodes.get(edge.target)!;
                  const curved = edge.source !== edge.target && edgeKeys.has(`${edge.target}\n${edge.source}`);
                  const active = !!focus && (edge.source === focus || edge.target === focus);
                  const label = labelPosition(source, edge.source === edge.target ? source : target, sourceNode.radius, curved);
                  return (
                    <g
                      key={`${edge.source} ${edge.target}`}
                      className={`modeler-edge${active ? " active" : ""}${focus && !active ? " dimmed" : ""}`}
                      // The active edges take the color of the focused type
                      style={active ? ({ "--edge-color": allNodes.get(focus!)?.color } as React.CSSProperties) : undefined}
                    >
                      <path
                        d={edgePath(source, edge.source === edge.target ? source : target, sourceNode.radius, targetNode.radius, curved)}
                        markerEnd="url(#modeler-arrow)"
                      >
                        <title>{`${sourceNode.label} → ${targetNode.label}: ${edge.labels.join(", ")}`}</title>
                      </path>
                      {(showLabels || active) && (
                        <text x={label.x} y={label.y} className="modeler-edge-label" textAnchor="middle">
                          {edge.labels.length > 2 ? `${edge.labels.slice(0, 2).join(", ")} +${edge.labels.length - 2}` : edge.labels.join(", ")}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
              <g>
                {nodes.map((node) => {
                  const p = position(node.identifier);
                  const dimmed = (!!needle && !matches(node)) || (!needle && !isHighlighted(node.identifier));
                  return (
                    <g
                      key={node.identifier}
                      transform={`translate(${p.x} ${p.y})`}
                      className={`modeler-node${node.identifier === selected ? " selected" : ""}${node.external ? " external" : ""}${dimmed ? " dimmed" : ""}`}
                      data-id={node.identifier}
                      // d3 suppresses the click after dragging the node
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchParams({ type: node.identifier });
                      }}
                      onPointerEnter={() => setHovered(node.identifier)}
                      onPointerLeave={() => setHovered(undefined)}
                      data-testid="modeler-node"
                    >
                      <title>{node.identifier}</title>
                      <circle r={node.radius} fill={node.external ? "none" : node.color} />
                      <text y={node.radius + 14} textAnchor="middle" className="modeler-node-label">
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        </div>
        <div className="modeler-result-count mt-1">
          {nodes.length} types, {edges.length} relations - drag the types to arrange them (the arrangement is kept in this browser), scroll to zoom, click a type to select it.
        </div>
      </Col>
      {selectedNode && (
        <Col lg={3}>
          <SelectionPanel node={selectedNode} type={selectedType} relations={allRelations} nodes={allNodes} />
        </Col>
      )}
    </Row>
  );
}

function SelectionPanel({
  node,
  type,
  relations: rels,
  nodes,
}: {
  node: GraphNode;
  type?: ModelType;
  relations: Relation[];
  nodes: Map<string, GraphNode>;
}) {
  const outgoing = rels.filter((relation) => relation.source === node.identifier);
  const incoming = rels.filter((relation) => relation.target === node.identifier);
  const link = (identifier: string) => (
    <Link to={`?type=${encodeURIComponent(identifier)}`} className="modeler-type-link" title={identifier}>
      <span className="modeler-color-dot me-1" style={{ backgroundColor: nodes.get(identifier)?.color ?? DEFAULT_COLOR }} />
      {nodes.get(identifier)?.label ?? shortName(identifier)}
    </Link>
  );
  return (
    <div className="modeler-side-panel" style={{ "--modeler-type-color": node.color } as React.CSSProperties}>
      <div className="instance-type-label">
        <span className="modeler-color-dot me-2" style={{ backgroundColor: node.color }} />
        Type
      </div>
      <div className="modeler-side-panel-name">{node.label}</div>
      <div className="mb-2">
        <TypeIdentifier identifier={node.identifier} />
      </div>
      {type ? (
        <>
          {type.description && <p>{type.description}</p>}
          <p className="mb-2 text-muted modeler-num">
            {type.properties.length} properties, {type.occurrences ?? 0} instances
          </p>
          <Link
            to={`/modeler/types?type=${encodeURIComponent(node.identifier)}`}
            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center mb-3"
          >
            <Pencil size={14} className="me-1" />
            Edit type
          </Link>
        </>
      ) : (
        <p className="text-muted">This type is linked to but not part of the model (or not visible to you).</p>
      )}
      <div className="modeler-kicker">Links to ({outgoing.length})</div>
      {outgoing.length === 0 ? (
        <p className="text-muted">No relations.</p>
      ) : (
        <ul className="list-unstyled">
          {outgoing.map((relation) => (
            <li key={`${relation.property} ${relation.target}`} className="mb-1">
              <span className="fw-medium" title={relation.property}>
                {relation.label}
              </span>
              <span className="text-muted mx-1">→</span>
              {link(relation.target)}
            </li>
          ))}
        </ul>
      )}
      <div className="modeler-kicker">Linked from ({incoming.length})</div>
      {incoming.length === 0 ? (
        <p className="text-muted mb-0">No relations.</p>
      ) : (
        <ul className="list-unstyled mb-0">
          {incoming.map((relation) => (
            <li key={`${relation.source} ${relation.property}`} className="mb-1">
              {link(relation.source)}
              <span className="text-muted mx-1">via</span>
              <span className="fw-medium" title={relation.property}>
                {relation.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
