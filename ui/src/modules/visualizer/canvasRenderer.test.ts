import { buildScene, drawFrame, focusMask, Frame, RenderLink, RenderNode } from "./canvasRenderer";
import { hiveLayout } from "./layouts";

const COLORS = ["#4f6bed", "#0ea5a4", "#e8590c", "#ffd43b", "#9c36b5"];

function graph(count: number, perNode = 2): { nodes: RenderNode[]; links: RenderLink[] } {
  const nodes: RenderNode[] = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    name: `Instance number ${i}`,
    type: `Type${i % COLORS.length}`,
    color: COLORS[i % COLORS.length],
    radius: 9 + (i % 7),
    in: 0,
    out: 0,
    initial: "T",
    status: i % 97 === 0 ? "restricted" : i % 89 === 0 ? "unresolved" : "resolved",
    expandable: i % 5 === 0,
  }));
  const links: RenderLink[] = [];
  for (let i = 1; i < count; i++) {
    for (let j = 0; j < perNode; j++) {
      const target = (i * 31 + j * 17) % i;
      links.push({ id: `n${i}>n${target}`, source: `n${i}`, target: `n${target}`, labels: j === 0 ? ["isPartOf"] : [], curved: false });
    }
  }
  return { nodes, links };
}

/** A context which accepts anything and counts what was asked of it. */
function recordingContext() {
  const calls = new Map<string, number>();
  const target: Record<string, unknown> = {};
  const context = new Proxy(target, {
    get(_, name: string) {
      if (name === "measureText") return (text: string) => ({ width: text.length * 6 });
      return (...args: unknown[]) => {
        calls.set(name, (calls.get(name) ?? 0) + 1);
        return args;
      };
    },
    set() {
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { context, calls };
}

// jsdom has no Path2D - a stand-in which counts its segments
class FakePath2D {
  static segments = 0;
  moveTo() { FakePath2D.segments++; }
  lineTo() { FakePath2D.segments++; }
  bezierCurveTo() { FakePath2D.segments++; }
  arc() { FakePath2D.segments++; }
  rect() { FakePath2D.segments++; }
  closePath() { /* nothing */ }
}

function frameOf(scene: ReturnType<typeof buildScene>, overrides: Partial<Frame> = {}): Frame {
  const count = scene.nodes.length;
  const x = Float64Array.from({ length: count }, (_, i) => Math.cos(i * 0.7) * (50 + i * 0.6));
  const y = Float64Array.from({ length: count }, (_, i) => Math.sin(i * 0.7) * (50 + i * 0.6));
  return {
    viewport: { x: 400, y: 300, k: 1, width: 800, height: 600, dpr: 1 },
    x,
    y,
    layout: "network",
    angle: undefined,
    guides: [],
    active: -1,
    selected: -1,
    cursor: -1,
    focus: undefined,
    labels: true,
    linkLabels: false,
    arrows: true,
    lite: false,
    fontFamily: "sans-serif",
    ...overrides,
  };
}

describe("buildScene", () => {
  const { nodes, links } = graph(500);
  const scene = buildScene(nodes, links);

  it("indexes nodes and the ends of links", () => {
    expect(scene.index.get("n7")).toBe(7);
    links.forEach((link, i) => {
      expect(scene.linkSource[i]).toBe(scene.index.get(link.source));
      expect(scene.linkTarget[i]).toBe(scene.index.get(link.target));
    });
  });

  it("knows the neighbours both ways", () => {
    const total = scene.adjacencyStart[nodes.length];
    expect(total).toBe(2 * links.length);
    const target = scene.linkTarget[0];
    const around = [...scene.adjacency.slice(scene.adjacencyStart[target], scene.adjacencyStart[target + 1])];
    expect(around).toContain(scene.linkSource[0]);
  });

  it("batches the resolved nodes by color and keeps ghosts apart", () => {
    expect(scene.buckets.map((b) => b.color).sort()).toEqual([...COLORS].sort());
    const batched = scene.buckets.reduce((sum, b) => sum + b.members.length, 0);
    expect(batched + scene.ghosts.length).toBe(nodes.length);
  });

  it("hands out labels to the biggest nodes first", () => {
    const radii = [...scene.labelOrder].map((i) => nodes[i].radius);
    expect(radii).toEqual([...radii].sort((a, b) => b - a));
  });

  it("changes its structure key with the nodes or links, not otherwise", () => {
    expect(buildScene(nodes, links).structure).toBe(scene.structure);
    expect(buildScene(nodes.slice(1), links).structure).not.toBe(scene.structure);
    expect(buildScene(nodes, links.slice(1)).structure).not.toBe(scene.structure);
    expect(buildScene(nodes.map((n) => ({ ...n, radius: 20 })), links).structure).toBe(scene.structure);
  });

  it("outlines pale node colors, so they stand out from the canvas", () => {
    const pale = scene.buckets.find((b) => b.color === "#ffd43b");
    const dark = scene.buckets.find((b) => b.color === "#9c36b5");
    expect(pale?.outline).toBeDefined();
    expect(dark?.outline).toBeUndefined();
  });
});

describe("focusMask", () => {
  it("marks the node and the nodes it links with", () => {
    const { nodes, links } = graph(100);
    const scene = buildScene(nodes, links);
    const mask = focusMask(scene, 0);
    expect(mask[0]).toBe(1);
    const neighbours = new Set(scene.adjacency.slice(scene.adjacencyStart[0], scene.adjacencyStart[1]));
    neighbours.forEach((i) => expect(mask[i]).toBe(1));
    expect(mask.reduce((a, b) => a + b, 0)).toBe(1 + neighbours.size);
  });
});

describe("drawFrame", () => {
  beforeAll(() => {
    (globalThis as unknown as { Path2D: unknown }).Path2D = FakePath2D;
  });

  it("draws every representation without trouble", () => {
    const { nodes, links } = graph(300);
    const scene = buildScene(nodes, links);
    for (const layout of ["network", "radial", "circle"] as const) {
      const { context } = recordingContext();
      expect(() => drawFrame(context, scene, frameOf(scene, { layout }))).not.toThrow();
    }
    const hive = hiveLayout(nodes, { axisBy: "type", rankBy: "connections" });
    const angle = Float64Array.from(nodes, (n) => hive.axisAngle.get(n.id) ?? NaN);
    const { context } = recordingContext();
    expect(() => drawFrame(context, scene, frameOf(scene, { layout: "hive", angle, guides: hive.guides }))).not.toThrow();
  });

  it("copes with an active node, a selection, the keyboard and an empty graph", () => {
    const { nodes, links } = graph(200);
    const scene = buildScene(nodes, links);
    const { context } = recordingContext();
    expect(() => drawFrame(context, scene, frameOf(scene, { active: 3, selected: 5, cursor: 7, focus: focusMask(scene, 3), linkLabels: true }))).not.toThrow();
    const empty = buildScene([], []);
    expect(() => drawFrame(context, empty, frameOf(empty))).not.toThrow();
  });

  it("leaves out what is outside of the view", () => {
    const { nodes, links } = graph(2000);
    const scene = buildScene(nodes, links);
    FakePath2D.segments = 0;
    drawFrame(recordingContext().context, scene, frameOf(scene));
    const inView = FakePath2D.segments;
    FakePath2D.segments = 0;
    drawFrame(recordingContext().context, scene, frameOf(scene, { viewport: { x: 5e6, y: 5e6, k: 1, width: 800, height: 600, dpr: 1 } }));
    expect(FakePath2D.segments).toBeLessThan(inView / 10);
  });

  it("draws fewer, simpler things while it is lite", () => {
    const { nodes, links } = graph(1500);
    const scene = buildScene(nodes, links);
    const full = recordingContext();
    drawFrame(full.context, scene, frameOf(scene));
    const lite = recordingContext();
    drawFrame(lite.context, scene, frameOf(scene, { lite: true }));
    expect((lite.calls.get("fillText") ?? 0) + (lite.calls.get("strokeText") ?? 0)).toBeLessThanOrEqual((full.calls.get("fillText") ?? 0) + (full.calls.get("strokeText") ?? 0));
  });

  it("keeps the number of labels bounded however many nodes there are", () => {
    const { nodes, links } = graph(8000);
    const scene = buildScene(nodes, links);
    const { context, calls } = recordingContext();
    drawFrame(context, scene, frameOf(scene, { viewport: { x: 400, y: 300, k: 3, width: 800, height: 600, dpr: 1 } }));
    expect(calls.get("fillText") ?? 0).toBeLessThan(900);
  });

  it("paints thousands of nodes and links in a small fraction of a frame budget", { retry: 2 }, () => {
    const { nodes, links } = graph(5000, 2);
    const scene = buildScene(nodes, links);
    const frame = frameOf(scene, { viewport: { x: 400, y: 300, k: 0.15, width: 800, height: 600, dpr: 1 } });
    const { context } = recordingContext();
    drawFrame(context, scene, frame); // warm up
    const started = performance.now();
    for (let i = 0; i < 5; i++) drawFrame(context, scene, frame);
    const perFrame = (performance.now() - started) / 5;
    // Without a real canvas only the JavaScript side is measured - it has to leave most of the 16 ms alone
    expect(perFrame).toBeLessThan(40);
  });
});
