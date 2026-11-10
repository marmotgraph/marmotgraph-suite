import React from "react";
import { render, waitFor } from "@testing-library/react";
import GraphCanvas, { CanvasLink, CanvasNode } from "./GraphCanvas";

const nodes: CanvasNode[] = ["a", "b", "c"].map((id, i) => ({
  id,
  name: `Node ${id}`,
  type: "Dataset",
  color: i === 0 ? "#ffd43b" : "#4f6bed",
  radius: 12,
  in: 1,
  out: 1,
  initial: "D",
  status: "resolved" as const,
  expandable: i === 1,
}));
const links: CanvasLink[] = [
  { id: "a>b", source: "a", target: "b", labels: [], curved: false },
  { id: "b>c", source: "b", target: "c", labels: [], curved: false },
];

const props = {
  nodes,
  links,
  layout: "network" as const,
  hive: { axisBy: "type" as const, rankBy: "connections" as const },
  hops: new Map<string, number>(),
  showLabels: true,
  showLinkLabels: false,
  showArrows: true,
  onSelect: () => undefined,
  onExpand: () => undefined,
};

/** jsdom has no canvas - a context which accepts everything and remembers what was drawn. */
function stubCanvas() {
  const drawn = { clears: 0, fills: 0, strokes: 0 };
  const context = new Proxy(
    {},
    {
      get(_, name: string) {
        if (name === "measureText") return (text: string) => ({ width: text.length * 6 });
        if (name === "clearRect") return () => drawn.clears++;
        if (name === "fill") return () => drawn.fills++;
        if (name === "stroke") return () => drawn.strokes++;
        return () => undefined;
      },
      set: () => true,
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
  (globalThis as unknown as { Path2D: unknown }).Path2D = class {
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    arc() {}
    rect() {}
    closePath() {}
  };
  return drawn;
}

describe("GraphCanvas", () => {
  afterEach(() => vi.restoreAllMocks());

  it("paints the graph", async () => {
    const drawn = stubCanvas();
    render(<GraphCanvas {...props} />);
    await waitFor(() => expect(drawn.clears).toBeGreaterThan(0));
    expect(drawn.fills).toBeGreaterThan(0);
  });

  it("paints the graph in StrictMode too, which runs the effects twice", async () => {
    const drawn = stubCanvas();
    render(
      <React.StrictMode>
        <GraphCanvas {...props} />
      </React.StrictMode>,
    );
    await waitFor(() => expect(drawn.clears).toBeGreaterThan(0));
    expect(drawn.fills).toBeGreaterThan(0);
  });

  it("paints again when the selection changes", async () => {
    const drawn = stubCanvas();
    const { rerender } = render(
      <React.StrictMode>
        <GraphCanvas {...props} />
      </React.StrictMode>,
    );
    await waitFor(() => expect(drawn.clears).toBeGreaterThan(0));
    const before = drawn.clears;
    rerender(
      <React.StrictMode>
        <GraphCanvas {...props} selectedId="b" />
      </React.StrictMode>,
    );
    await waitFor(() => expect(drawn.clears).toBeGreaterThan(before));
  });

  it("gives the canvas a name and a way in for the keyboard", () => {
    stubCanvas();
    const { getByRole } = render(<GraphCanvas {...props} />);
    const canvas = getByRole("application");
    expect(canvas).toHaveAttribute("tabindex", "0");
    expect(canvas).toHaveAccessibleName("Knowledge graph, 3 instances and 2 links");
  });
});
