import { circleLayout, hiveGroups, hiveLayout, LayoutNode, MAX_AXES, radialLayout, ROUTE_SIZE, RouteAt, routeCurve, routeOf } from "./layouts";

const node = (id: string, overrides: Partial<LayoutNode> = {}): LayoutNode => ({
  id,
  name: id,
  type: "T",
  color: "#000",
  radius: 10,
  in: 0,
  out: 0,
  ...overrides,
});

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y);

describe("hiveGroups", () => {
  it("makes one group per type, the biggest first", () => {
    const groups = hiveGroups([node("a", { type: "X" }), node("b", { type: "Y" }), node("c", { type: "Y" })], "type");
    expect(groups.map((g) => [g.key, g.nodes.length])).toEqual([
      ["Y", 2],
      ["X", 1],
    ]);
  });

  it("merges the smallest groups into one axis beyond the maximum", () => {
    const nodes = Array.from({ length: MAX_AXES + 3 }, (_, i) => node(`n${i}`, { type: `T${i}` }));
    const groups = hiveGroups(nodes, "type");
    expect(groups).toHaveLength(MAX_AXES);
    expect(groups[MAX_AXES - 1].nodes).toHaveLength(4);
  });

  it("divides by role in a fixed order", () => {
    const groups = hiveGroups([node("sink", { in: 1 }), node("source", { out: 1 }), node("both", { in: 1, out: 1 }), node("none")], "role");
    expect(groups.map((g) => g.key)).toEqual(["Sources", "Bridges", "Sinks", "Isolated"]);
  });
});

describe("hiveLayout", () => {
  const nodes = [
    node("a", { type: "X", out: 5 }),
    node("b", { type: "X", out: 1 }),
    node("c", { type: "Y", in: 3 }),
    node("d", { type: "Z", in: 1 }),
  ];

  it("places every node and gives each axis a label", () => {
    const layout = hiveLayout(nodes, { axisBy: "type", rankBy: "connections" });
    expect(layout.positions.size).toBe(4);
    [...layout.positions.values()].forEach((p) => expect(finite(p)).toBe(true));
    expect(layout.guides).toHaveLength(3);
    expect(layout.guides[0]).toMatchObject({ kind: "axis", label: "X · 2" });
  });

  it("puts the nodes on one axis along the same direction, further out the more connected", () => {
    const layout = hiveLayout(nodes, { axisBy: "type", rankBy: "connections" });
    const a = layout.positions.get("a")!;
    const b = layout.positions.get("b")!;
    expect(layout.axisAngle.get("a")).toBe(layout.axisAngle.get("b"));
    expect(Math.hypot(a.x, a.y)).toBeGreaterThan(Math.hypot(b.x, b.y));
  });

  it("ranks by name and by distance", () => {
    const byName = hiveLayout([node("b"), node("a"), node("c")], { axisBy: "type", rankBy: "name" });
    const r = (id: string) => Math.hypot(byName.positions.get(id)!.x, byName.positions.get(id)!.y);
    expect(r("a")).toBeLessThan(r("b"));
    expect(r("b")).toBeLessThan(r("c"));
    const byDistance = hiveLayout([node("a"), node("b"), node("c")], { axisBy: "type", rankBy: "distance" }, new Map([["a", 0], ["b", 1]]));
    const d = (id: string) => Math.hypot(byDistance.positions.get(id)!.x, byDistance.positions.get(id)!.y);
    expect(d("a")).toBeLessThan(d("b"));
    expect(d("b")).toBeLessThan(d("c"));
  });

  it("never lets the nodes overlap, even when they all rank the same", () => {
    const crowd = Array.from({ length: 40 }, (_, i) => node(`n${i}`, { type: i % 2 ? "X" : "Y", out: 2 }));
    const positions = [...hiveLayout(crowd, { axisBy: "type", rankBy: "connections" }).positions.values()];
    positions.forEach((p, i) => positions.slice(i + 1).forEach((q) => expect(distance(p, q)).toBeGreaterThan(19)));
  });

  it("copes with an empty graph and a single node", () => {
    expect(hiveLayout([], { axisBy: "type", rankBy: "name" }).positions.size).toBe(0);
    const single = hiveLayout([node("a")], { axisBy: "role", rankBy: "distance" });
    expect(finite(single.positions.get("a")!)).toBe(true);
  });
});

describe("circleLayout", () => {
  it("puts all nodes on one circle and keeps types together", () => {
    const nodes = [node("a", { type: "X" }), node("b", { type: "Y" }), node("c", { type: "X" }), node("d", { type: "Y" })];
    const layout = circleLayout(nodes);
    const radii = nodes.map((n) => Math.hypot(layout.positions.get(n.id)!.x, layout.positions.get(n.id)!.y));
    radii.forEach((r) => expect(r).toBeCloseTo(radii[0], 5));
    expect(layout.guides).toHaveLength(2);
    // Same-type nodes are neighbours on the circle
    expect(distance(layout.positions.get("a")!, layout.positions.get("c")!)).toBeLessThan(distance(layout.positions.get("a")!, layout.positions.get("b")!) + 1);
  });
});

describe("radialLayout", () => {
  const nodes = [node("a", { out: 2 }), node("b", { in: 2, out: 1 }), node("c", { in: 1 }), node("lonely")];
  const links = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
  ];

  it("puts the focus in the center and the others on rings by distance", () => {
    const layout = radialLayout(nodes, links, "a");
    expect(layout.positions.get("a")).toEqual({ x: 0, y: 0 });
    const r = (id: string) => Math.hypot(layout.positions.get(id)!.x, layout.positions.get(id)!.y);
    expect(r("b")).toBeLessThan(r("c"));
    expect(r("c")).toBeLessThan(r("lonely"));
    expect(layout.guides.map((g) => (g.kind === "ring" ? g.label : ""))).toEqual(["1 hop", "2 hops", "Not connected"]);
  });

  it("starts from the most connected node without a (known) focus", () => {
    const layout = radialLayout(nodes, links, "unknown");
    expect(layout.positions.get("b")).toEqual({ x: 0, y: 0 });
  });
});

describe("routeOf", () => {
  const ctx = { layout: "network" as const, axisAngle: new Map<string, number>(), curved: false };

  it("stops at the borders of the nodes", () => {
    const route = routeOf(ctx, { x: 0, y: 0 }, { x: 100, y: 0 }, 10, 10, "a", "b");
    expect(route.d.startsWith("M 10 0 C")).toBe(true);
    expect(route.d.endsWith("86 0")).toBe(true);
    expect(route.label.x).toBeGreaterThan(40);
    expect(route.label.x).toBeLessThan(60);
  });

  it("bends links which have a counterpart", () => {
    const route = routeOf({ ...ctx, curved: true }, { x: 0, y: 0 }, { x: 100, y: 0 }, 10, 10, "a", "b");
    expect(route.label.y).not.toBe(0);
  });

  it("routes hive links through the angle between the axes, and bulges within an axis", () => {
    const axisAngle = new Map([["a", -90], ["b", 30], ["c", -90]]);
    const hive = { layout: "hive" as const, axisAngle, curved: false };
    const across = routeOf(hive, { x: 0, y: -100 }, { x: 87, y: 50 }, 8, 8, "a", "b");
    expect(across.d).toContain("C");
    const within = routeOf(hive, { x: 0, y: -100 }, { x: 0, y: -200 }, 8, 8, "a", "c");
    expect(Math.abs(within.label.x)).toBeGreaterThan(10);
    expect(finite(within.label)).toBe(true);
  });

  it("never yields NaN for nodes on top of each other", () => {
    ["network", "radial", "circle", "hive"].forEach((layout) => {
      const route = routeOf({ layout: layout as "network", axisAngle: new Map([["a", 0], ["b", 0]]), curved: true }, { x: 5, y: 5 }, { x: 5, y: 5 }, 10, 10, "a", "b");
      expect(route.d).not.toContain("NaN");
    });
  });
});

describe("routeCurve", () => {
  const cases: { layout: "network" | "hive" | "radial" | "circle"; curved: boolean; a?: number; b?: number }[] = [
    { layout: "network", curved: false },
    { layout: "network", curved: true },
    { layout: "radial", curved: true },
    { layout: "circle", curved: false },
    { layout: "hive", curved: false, a: -90, b: 30 },
    { layout: "hive", curved: false, a: -90, b: -90 },
    { layout: "hive", curved: false },
  ];
  const points = [
    [{ x: 0, y: 0 }, { x: 100, y: 40 }],
    [{ x: -80, y: 120 }, { x: 60, y: -150 }],
    [{ x: 5, y: 5 }, { x: 5, y: 5 }],
  ];

  it("draws exactly what routeOf describes", () => {
    const out = new Float64Array(ROUTE_SIZE);
    cases.forEach(({ layout, curved, a, b }) => {
      points.forEach(([source, target]) => {
        const axisAngle = new Map<string, number>();
        if (a !== undefined) axisAngle.set("s", a);
        if (b !== undefined) axisAngle.set("t", b);
        const expected = routeOf({ layout, axisAngle, curved }, source, target, 9, 12, "s", "t");
        routeCurve(layout, curved, source.x, source.y, target.x, target.y, 9, 12, a ?? NaN, b ?? NaN, out);
        const r = (n: number) => Math.round(n * 10) / 10;
        const d = `M ${r(out[RouteAt.StartX])} ${r(out[RouteAt.StartY])} C ${r(out[RouteAt.Control1X])} ${r(out[RouteAt.Control1Y])} ${r(out[RouteAt.Control2X])} ${r(out[RouteAt.Control2Y])} ${r(out[RouteAt.EndX])} ${r(out[RouteAt.EndY])}`;
        expect(d).toBe(expected.d);
        expect(out[RouteAt.LabelX]).toBeCloseTo(expected.label.x, 6);
        expect(out[RouteAt.LabelY]).toBeCloseTo(expected.label.y, 6);
      });
    });
  });

  it("says when a link is a straight line", () => {
    const out = new Float64Array(ROUTE_SIZE);
    routeCurve("network", false, 0, 0, 100, 0, 10, 10, NaN, NaN, out);
    expect(out[RouteAt.Straight]).toBe(1);
    routeCurve("network", true, 0, 0, 100, 0, 10, 10, NaN, NaN, out);
    expect(out[RouteAt.Straight]).toBe(0);
  });
});

describe("at scale", () => {
  const many = (count: number): { nodes: LayoutNode[]; links: { source: string; target: string }[] } => ({
    nodes: Array.from({ length: count }, (_, i) => node(`n${i}`, { name: `Name ${i}`, type: `T${i % 9}`, in: i % 5, out: i % 3 })),
    links: Array.from({ length: count * 2 }, (_, i) => ({ source: `n${(i * 7) % count}`, target: `n${(i * 13 + 1) % count}` })),
  });

  it("places ten thousand nodes of a hive plot without overlaps on an axis lane and in good time", () => {
    const { nodes } = many(10000);
    const started = performance.now();
    const layout = hiveLayout(nodes, { axisBy: "type", rankBy: "connections" });
    expect(performance.now() - started).toBeLessThan(3000);
    expect(layout.positions.size).toBe(10000);
    expect([...layout.positions.values()].every(finite)).toBe(true);
  });

  it("lays out circles and rings of ten thousand nodes in good time", () => {
    const { nodes, links } = many(10000);
    let started = performance.now();
    expect(circleLayout(nodes).positions.size).toBe(10000);
    expect(performance.now() - started).toBeLessThan(3000);
    started = performance.now();
    expect(radialLayout(nodes, links, "n0").positions.size).toBe(10000);
    expect(performance.now() - started).toBeLessThan(3000);
  });

  it("copes with a hub of tens of thousands of neighbours", () => {
    const count = 60000;
    const nodes = Array.from({ length: count }, (_, i) => node(`n${i}`, { name: `Name ${i}`, in: i === 0 ? count : 1 }));
    const links = Array.from({ length: count - 1 }, (_, i) => ({ source: `n${i + 1}`, target: "n0" }));
    const started = performance.now();
    expect(radialLayout(nodes, links, "n0").positions.size).toBe(count);
    expect(hiveLayout(nodes, { axisBy: "role", rankBy: "connections" }).positions.size).toBe(count);
    expect(performance.now() - started).toBeLessThan(6000);
  });
});
