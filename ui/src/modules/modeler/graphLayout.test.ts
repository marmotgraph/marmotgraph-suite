import { layoutGraph } from "./graphLayout";

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const nodes = (...identifiers: string[]) => identifiers.map((identifier) => ({ identifier, radius: 12 }));

describe("layoutGraph", () => {
  it("places nothing for an empty graph", () => {
    expect(layoutGraph([], []).size).toBe(0);
  });

  it("places linked nodes at about the link distance", () => {
    const positions = layoutGraph(nodes("a", "b", "c", "d"), [
      { source: "a", target: "b" },
      { source: "c", target: "d" },
    ]);
    [distance(positions.get("a")!, positions.get("b")!), distance(positions.get("c")!, positions.get("d")!)].forEach((d) => {
      expect(d).toBeGreaterThan(100);
      expect(d).toBeLessThan(200);
    });
  });

  it("doesn't let nodes overlap", () => {
    const positions = [...layoutGraph(nodes("a", "b", "c", "d", "e"), []).values()];
    positions.forEach((p, i) => positions.slice(i + 1).forEach((q) => expect(distance(p, q)).toBeGreaterThan(24)));
  });

  it("is deterministic and ignores self references and unknown nodes", () => {
    const edges = [
      { source: "a", target: "a" },
      { source: "a", target: "unknown" },
      { source: "a", target: "b" },
    ];
    const first = layoutGraph(nodes("a", "b", "c"), edges);
    expect(layoutGraph(nodes("a", "b", "c"), edges)).toEqual(first);
    [...first.values()].forEach((p) => {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    });
  });

  it("keeps the fixed nodes and places the others around them", () => {
    const fixed = new Map([
      ["a", { x: 1000, y: 500 }],
      ["b", { x: 1200, y: 500 }],
    ]);
    const positions = layoutGraph(nodes("a", "b", "c"), [{ source: "a", target: "c" }], fixed);
    expect(positions.get("a")).toEqual({ x: 1000, y: 500 });
    expect(positions.get("b")).toEqual({ x: 1200, y: 500 });
    expect(distance(positions.get("c")!, { x: 1100, y: 500 })).toBeLessThan(600);
  });

  it("keeps the positions if all nodes are fixed", () => {
    expect(layoutGraph(nodes("a"), [], new Map([["a", { x: -5, y: 7 }]])).get("a")).toEqual({ x: -5, y: 7 });
  });
});
