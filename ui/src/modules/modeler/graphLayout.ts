import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from "d3-force";

export interface Point {
  x: number;
  y: number;
}

export interface LayoutNode {
  identifier: string;
  radius: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

interface SimulationNode extends SimulationNodeDatum {
  identifier: string;
  radius: number;
}

/** The ideal distance between linked nodes. */
const LINK_DISTANCE = 140;
/** The free space kept around a node (e.g. for its label). */
const NODE_PADDING = 30;

/**
 * Places the nodes of a graph with the force simulation of d3: linked nodes attract each other, all nodes repel each
 * other and don't overlap. The simulation is run to its end at once (instead of being animated) so the graph is
 * shown in its final state - the result is deterministic since d3 places new nodes on a fixed spiral and uses a
 * seeded random source.
 * <p>
 * Nodes with a fixed position (e.g. arranged by the user) keep it - only the other nodes are placed (around them).
 *
 * @param fixed the positions of the nodes which must not be moved
 */
export function layoutGraph(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  fixed: ReadonlyMap<string, Point> = new Map(),
): Map<string, Point> {
  const pinned = nodes.filter((node) => fixed.has(node.identifier));
  // The free nodes are placed around the fixed ones
  const center = { x: 0, y: 0 };
  pinned.forEach((node) => {
    center.x += fixed.get(node.identifier)!.x / pinned.length;
    center.y += fixed.get(node.identifier)!.y / pinned.length;
  });
  const simulationNodes: SimulationNode[] = nodes.map((node) => {
    const p = fixed.get(node.identifier);
    return p ? { ...node, x: p.x, y: p.y, fx: p.x, fy: p.y } : { ...node };
  });

  if (pinned.length < nodes.length) {
    const known = new Set(nodes.map((node) => node.identifier));
    const links: SimulationLinkDatum<SimulationNode>[] = edges
      .filter((edge) => edge.source !== edge.target && known.has(edge.source) && known.has(edge.target))
      .map((edge) => ({ source: edge.source, target: edge.target }));
    const simulation = forceSimulation(simulationNodes)
      .force("link", forceLink<SimulationNode, SimulationLinkDatum<SimulationNode>>(links).id((node) => node.identifier).distance(LINK_DISTANCE))
      .force("charge", forceManyBody().strength(-500))
      .force("collide", forceCollide<SimulationNode>((node) => node.radius + NODE_PADDING))
      // A weak pull towards the center keeps unconnected parts of the graph from drifting away
      .force("x", forceX(center.x).strength(0.05))
      .force("y", forceY(center.y).strength(0.05))
      .stop();
    // Starting off the center of the fixed nodes, the free nodes would otherwise have to travel through them
    simulationNodes.forEach((node) => {
      if (node.fx === undefined && node.x !== undefined && node.y !== undefined) {
        node.x += center.x;
        node.y += center.y;
      }
    });
    // As many ticks as the simulation takes to cool down (alpha from 1 to alphaMin) - 300 with the defaults
    simulation.tick(Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())));
  }

  return new Map(simulationNodes.map((node) => [node.identifier, { x: node.x ?? 0, y: node.y ?? 0 }]));
}
