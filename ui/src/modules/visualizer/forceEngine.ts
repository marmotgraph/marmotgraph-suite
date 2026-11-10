import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, Simulation, SimulationLinkDatum, SimulationNodeDatum } from "d3-force";

/** What the simulation starts from - plain typed arrays, so it can be handed to a worker cheaply. */
export interface EngineInput {
  x: Float64Array;
  y: Float64Array;
  radius: Float64Array;
  /** Pairs of node indices: source, target, source, target, ... */
  links: Uint32Array;
}

interface Body extends SimulationNodeDatum {
  r: number;
}

export interface Tuning {
  charge: number;
  distanceMax: number;
  theta: number;
  linkDistance: number;
  linkStrength: number;
  gravity: number;
  alphaDecay: number;
  collide: boolean;
}

/**
 * The bigger the graph, the cheaper (and tighter) the simulation: a link is shorter, the repulsion reaches less far,
 * and above a few thousand nodes nodes may overlap (the collision force is the costliest part).
 */
export function tuningFor(count: number): Tuning {
  if (count <= 600) {
    return { charge: -240, distanceMax: 520, theta: 0.9, linkDistance: 86, linkStrength: 0.5, gravity: 0.035, alphaDecay: 0.028, collide: true };
  }
  if (count <= 3000) {
    return { charge: -150, distanceMax: 360, theta: 1, linkDistance: 56, linkStrength: 0.5, gravity: 0.03, alphaDecay: 0.036, collide: true };
  }
  return { charge: -80, distanceMax: 240, theta: 1.4, linkDistance: 34, linkStrength: 0.6, gravity: 0.022, alphaDecay: 0.05, collide: false };
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** The force-directed layout. It runs wherever it is created - see forceClient for the worker around it. */
export class ForceEngine {
  private readonly bodies: Body[];
  private readonly simulation: Simulation<Body, SimulationLinkDatum<Body>>;

  constructor(input: EngineInput) {
    const count = input.x.length;
    this.bodies = Array.from({ length: count }, (_, i) => ({ x: input.x[i], y: input.y[i], r: input.radius[i] }));
    const links: SimulationLinkDatum<Body>[] = [];
    for (let i = 0; i + 1 < input.links.length; i += 2) {
      links.push({ source: input.links[i], target: input.links[i + 1] });
    }
    const tuning = tuningFor(count);
    // The simulation is stepped by hand (so a budget per frame can be kept), not by its own timer
    const simulation = forceSimulation<Body>(this.bodies)
      .stop()
      .force("link", forceLink<Body, SimulationLinkDatum<Body>>(links).distance(tuning.linkDistance).strength(tuning.linkStrength))
      .force("charge", forceManyBody<Body>().strength(tuning.charge).theta(tuning.theta).distanceMax(tuning.distanceMax))
      .force("x", forceX<Body>(0).strength(tuning.gravity))
      .force("y", forceY<Body>(0).strength(tuning.gravity))
      .alpha(0.9)
      .alphaDecay(tuning.alphaDecay);
    if (tuning.collide) {
      simulation.force("collide", forceCollide<Body>((d) => d.r + 7).iterations(1));
    }
    this.simulation = simulation;
  }

  get size(): number {
    return this.bodies.length;
  }

  /** Whether it has not settled yet (a node being dragged keeps it going). */
  get running(): boolean {
    return this.simulation.alpha() >= this.simulation.alphaMin() || this.simulation.alphaTarget() > 0;
  }

  /** Ticks until the budget (milliseconds) or the number of ticks is used up - returns whether it is still running. */
  step(budgetMs: number, maxTicks = Infinity): boolean {
    const started = now();
    for (let ticks = 0; this.running && ticks < maxTicks; ticks++) {
      this.simulation.tick();
      if (now() - started >= budgetMs) {
        break;
      }
    }
    return this.running;
  }

  /** Writes the positions to `out` (x, y, x, y, ...). */
  write(out: Float32Array): void {
    for (let i = 0; i < this.bodies.length; i++) {
      out[2 * i] = this.bodies[i].x ?? 0;
      out[2 * i + 1] = this.bodies[i].y ?? 0;
    }
  }

  pin(index: number, x: number, y: number): void {
    const body = this.bodies[index];
    if (body) {
      body.fx = x;
      body.fy = y;
    }
  }

  release(index: number): void {
    const body = this.bodies[index];
    if (body) {
      body.fx = null;
      body.fy = null;
    }
  }

  /** Keeps the simulation warm (e.g. while a node is dragged) - 0 lets it cool down. */
  reheat(target: number): void {
    this.simulation.alphaTarget(target);
  }
}
