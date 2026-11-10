import type { InstanceDetail, IncomingLinks } from "../../services/instances";
import {
  addDetail,
  addIncoming,
  addToGraph,
  degrees,
  EMPTY_GRAPH,
  filterGraph,
  hopsFrom,
  neighboursOf,
  nodeOfDetail,
  nodeOfLink,
  propertiesOf,
  removeNodes,
  typeColorOf,
  typePill,
  typeSummaries,
  updateNode,
} from "./graphModel";

const detail = (overrides: Partial<InstanceDetail> = {}): InstanceDetail => ({
  instanceId: "a",
  type: "Dataset",
  typeColor: "#123456",
  instanceName: "Alpha",
  space: "s1",
  permissions: "",
  releaseStatus: "released",
  directLinks: [
    { instanceId: "b", instanceName: "Beta", type: "Person", space: "s1", fieldLabel: "Author" },
    { instanceId: "c", instanceName: "x", type: "Person", space: "s2", fieldLabel: "Contact", linkStatus: "restricted" },
    { instanceId: "d", instanceName: "x", type: "Person", space: "s2", fieldLabel: "Contact", linkStatus: "unresolved" },
  ],
  ...overrides,
});

describe("typeColorOf", () => {
  it("keeps the color of the type", () => expect(typeColorOf("Dataset", "#abcdef")).toBe("#abcdef"));
  it("derives a stable color otherwise", () => {
    expect(typeColorOf("Dataset")).toBe(typeColorOf("Dataset"));
    expect(typeColorOf("Dataset")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("addDetail", () => {
  it("adds the instance and what it links to", () => {
    const { graph, omitted } = addDetail(EMPTY_GRAPH, detail());
    expect(omitted).toBe(0);
    expect([...graph.nodes.keys()]).toEqual(["a", "b", "c", "d"]);
    expect(graph.nodes.get("a")).toMatchObject({ expanded: true, color: "#123456", status: "resolved" });
    expect(graph.nodes.get("b")?.expanded).toBe(false);
    expect(graph.links.get("a>b")?.labels).toEqual(["Author"]);
  });

  it("keeps the targets it can't open as ghosts without leaking their names", () => {
    const { graph } = addDetail(EMPTY_GRAPH, detail());
    expect(graph.nodes.get("c")).toMatchObject({ status: "restricted", name: "Restricted instance" });
    expect(graph.nodes.get("d")).toMatchObject({ status: "unresolved", name: "Unknown connection" });
  });

  it("limits the links added and reports the rest", () => {
    const { graph, omitted } = addDetail(EMPTY_GRAPH, detail(), 1);
    expect(graph.nodes.size).toBe(2);
    expect(omitted).toBe(2);
  });
});

describe("addToGraph", () => {
  it("merges the labels of several properties between two instances", () => {
    let graph = addToGraph(EMPTY_GRAPH, [nodeOfLink({ instanceId: "a", instanceName: "A", type: "T", space: "s" }), nodeOfLink({ instanceId: "b", instanceName: "B", type: "T", space: "s" })], [
      { source: "a", target: "b", label: "author" },
      { source: "a", target: "b", label: "Author" },
      { source: "a", target: "b", label: "contact" },
    ]);
    expect(graph.links.get("a>b")?.labels).toEqual(["author", "contact"]);
    graph = addToGraph(graph, [], [{ source: "a", target: "a" }]);
    expect(graph.links.size).toBe(1);
  });

  it("ignores links to instances which are not in the graph", () => {
    expect(addToGraph(EMPTY_GRAPH, [], [{ source: "a", target: "b" }]).links.size).toBe(0);
  });

  it("never replaces a resolved instance by a ghost and keeps what is known", () => {
    const first = addDetail(EMPTY_GRAPH, detail()).graph;
    const again = addToGraph(first, [nodeOfLink({ instanceId: "a", instanceName: "?", type: "?", space: "", linkStatus: "restricted" })], []);
    expect(again.nodes.get("a")?.name).toBe("Alpha");
    const reloaded = addToGraph(first, [nodeOfLink({ instanceId: "b", instanceName: "Beta", type: "Person", space: "s1" })], []);
    expect(reloaded.nodes.get("a")?.expanded).toBe(true);
  });
});

describe("addIncoming", () => {
  const incoming: IncomingLinks[] = [
    {
      property: "https://example.org/vocab/author",
      label: "Is author of",
      types: [{ typeIdentifier: "Person", type: "Person", typeColor: "#fa0", links: [{ instanceId: "p", instanceName: "Pat", space: "s1" }] }],
    },
  ];

  it("adds the linking instances with a link towards the instance", () => {
    const graph = addIncoming(addDetail(EMPTY_GRAPH, detail()).graph, "a", incoming);
    expect(graph.links.get("p>a")?.labels).toEqual(["author"]);
    expect(graph.nodes.get("p")).toMatchObject({ name: "Pat", color: "#fa0" });
  });
});

describe("queries", () => {
  const graph = addIncoming(addDetail(EMPTY_GRAPH, detail()).graph, "a", [
    { property: "p", label: "", types: [{ typeIdentifier: "Org", type: "Org", links: [{ instanceId: "o", instanceName: "Org", space: "s" }] }] },
  ]);

  it("counts the degrees", () => {
    const d = degrees(graph);
    expect(d.get("a")).toEqual({ in: 1, out: 3 });
    expect(d.get("o")).toEqual({ in: 0, out: 1 });
  });

  it("summarizes the resolved types, the biggest first", () => {
    expect(typeSummaries(graph).map((t) => [t.type, t.count])).toEqual([
      ["Dataset", 1],
      ["Org", 1],
      ["Person", 1],
    ]);
  });

  it("lists the neighbours in both directions", () => {
    const neighbours = neighboursOf(graph, "a");
    expect(neighbours.filter((n) => n.outgoing)).toHaveLength(3);
    expect(neighbours.filter((n) => !n.outgoing).map((n) => n.node.id)).toEqual(["o"]);
  });

  it("measures the hops in either direction", () => {
    const hops = hopsFrom(graph, "o");
    expect(hops.get("o")).toBe(0);
    expect(hops.get("a")).toBe(1);
    expect(hops.get("b")).toBe(2);
    expect(hopsFrom(graph, "missing").size).toBe(0);
  });

  it("removes nodes with their links and hides types", () => {
    const smaller = removeNodes(graph, ["b"]);
    expect(smaller.nodes.has("b")).toBe(false);
    expect(smaller.links.has("a>b")).toBe(false);
    const filtered = filterGraph(graph, new Set(["Person"]));
    expect([...filtered.nodes.keys()].sort()).toEqual(["a", "o"]);
    expect(filterGraph(graph, new Set())).toBe(graph);
  });

  it("updates a node without losing its place", () => {
    const updated = updateNode(graph, nodeOfDetail(detail({ instanceId: "b", instanceName: "Beta!", type: "Person" }), false));
    expect(updated.nodes.get("b")?.name).toBe("Beta!");
    expect(updateNode(graph, nodeOfLink({ instanceId: "zzz", instanceName: "", type: "", space: "" }))).toBe(graph);
  });
});

describe("propertiesOf", () => {
  it("keeps the plain values, not the label property or links", () => {
    expect(
      propertiesOf([
        { identifier: "n", label: "Name", kind: "TEXT", value: "Alpha", required: false, readOnly: false, labelProperty: true },
        { identifier: "d", label: "Description", kind: "TEXTAREA", value: "Text", required: false, readOnly: false },
        { identifier: "k", label: "Keywords", kind: "TEXTS", value: ["x", "y"], required: false, readOnly: false },
        { identifier: "e", label: "Empty", kind: "TEXT", value: "", required: false, readOnly: false },
        { identifier: "o", label: "Open", kind: "CHECKBOX", value: true, required: false, readOnly: false },
        { identifier: "l", label: "Links", kind: "LINKS", value: [{}], required: false, readOnly: false },
      ]),
    ).toEqual([
      { label: "Description", value: "Text" },
      { label: "Keywords", value: "x, y" },
      { label: "Open", value: "Yes" },
    ]);
  });
});

describe("typePill", () => {
  const types = (n: number) => Array.from({ length: n }, (_, i) => ({ type: `T${i}`, color: "#000", count: 1 }));

  it("has no chip while every type is shown", () => expect(typePill(types(5), new Set())).toBeUndefined());

  it("always counts what is shown, however few or many types are hidden", () => {
    expect(typePill(types(50), new Set(["T0"]))).toMatchObject({ label: "Types", value: "49 of 50 shown" });
    expect(typePill(types(50), new Set(types(50).slice(0, 48).map((t) => t.type)))).toMatchObject({ label: "Types", value: "2 of 50 shown" });
  });

  it("lists the shown types on hover - and says how many more there are", () => {
    expect(typePill(types(4), new Set(["T0", "T1"]))?.title).toBe("Shown: T2, T3");
    expect(typePill(types(40), new Set(["T0"]))?.title).toMatch(/^Shown: T1, T2.*T12 and 27 more$/);
  });

  it("says so when no type is shown", () => {
    expect(typePill(types(4), new Set(types(4).map((t) => t.type)))).toMatchObject({ value: "0 of 4 shown", title: "No type is shown" });
  });

  it("ignores hidden types which are not in the graph", () => {
    expect(typePill(types(3), new Set(["Gone"]))).toBeUndefined();
  });
});
