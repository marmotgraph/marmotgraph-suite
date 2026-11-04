import { ReleaseNode } from "../../services/instances";
import {
  availableActions,
  flattenReleaseTree,
  markAll,
  pendingOperations,
  pendingStatus,
  prepareReleaseTree,
  releaseStats,
} from "./releaseTree";

function node(
  instanceId: string,
  overrides: Partial<ReleaseNode> = {},
  children: ReleaseNode[] = [],
): ReleaseNode {
  return {
    instanceId,
    instanceName: instanceId,
    type: "Device",
    releaseStatus: "released",
    canRelease: true,
    canUnrelease: true,
    children,
    ...overrides,
  };
}

const ids = (nodes: { node: ReleaseNode }[]) =>
  nodes.map((entry) => entry.node.instanceId);

describe("prepareReleaseTree", () => {
  it("sorts the children by type and name", () => {
    const tree = prepareReleaseTree(
      node("root", {}, [
        node("b", { type: "Rack", instanceName: "beta" }),
        node("c", { type: "cabinet", instanceName: "Zeta" }),
        node("a", { type: "Rack", instanceName: "Alpha" }),
      ]),
    );

    expect(tree.children.map((c) => c.instanceId)).toEqual(["c", "a", "b"]);
  });

  it("keeps only the first occurrence of an instance reached by several paths", () => {
    const tree = prepareReleaseTree(
      node("root", {}, [
        node("a", {}, [node("shared"), node("root")]),
        node("shared", {}, [node("x")]),
      ]),
    );

    expect(tree.children.map((c) => c.instanceId)).toEqual(["a", "shared"]);
    expect(tree.children[0].children).toEqual([]);
    expect(tree.children[1].children.map((c) => c.instanceId)).toEqual(["x"]);
  });
});

describe("availableActions", () => {
  it("offers to release instances which are not released and to unrelease released ones", () => {
    expect(availableActions(node("a", { releaseStatus: "in progress" }))).toEqual(
      ["release", "none"],
    );
    expect(availableActions(node("a", { releaseStatus: "released" }))).toEqual([
      "none",
      "unrelease",
    ]);
    expect(availableActions(node("a", { releaseStatus: "has changed" }))).toEqual(
      ["release", "none", "unrelease"],
    );
  });

  it("only offers the actions the user is allowed to", () => {
    expect(
      availableActions(
        node("a", {
          releaseStatus: "has changed",
          canRelease: false,
          canUnrelease: false,
        }),
      ),
    ).toEqual(["none"]);
  });
});

describe("pending actions", () => {
  const tree = node("root", { releaseStatus: "has changed" }, [
    node("a", { releaseStatus: "in progress" }),
    node("b", { releaseStatus: "released" }),
    node("c", { releaseStatus: "in progress", canRelease: false }),
  ]);

  it("marks all instances which can be released", () => {
    expect(markAll(tree, "release")).toEqual({ root: "release", a: "release" });
  });

  it("derives the status after proceeding", () => {
    const pending = { root: "release", b: "unrelease" } as const;

    expect(pendingStatus(tree, pending)).toBe("released");
    expect(pendingStatus(tree.children[1], pending)).toBe("in progress");
    expect(pendingStatus(tree.children[0], pending)).toBe("in progress");
  });

  it("counts the instances per status now and after proceeding", () => {
    const stats = releaseStats(tree, { root: "release", b: "unrelease" });

    expect(stats.total).toBe(4);
    expect(stats.current).toEqual({
      released: 1,
      "has changed": 1,
      "in progress": 2,
    });
    expect(stats.after).toEqual({
      released: 1,
      "has changed": 0,
      "in progress": 3,
    });
    expect(stats.toRelease).toBe(1);
    expect(stats.toUnrelease).toBe(1);
  });

  it("carries out the releases before the unreleases and skips unavailable actions", () => {
    const operations = pendingOperations(tree, {
      root: "unrelease",
      a: "release",
      c: "release",
    });

    expect(operations.map((o) => [o.node.instanceId, o.action])).toEqual([
      ["a", "release"],
      ["root", "unrelease"],
    ]);
  });
});

describe("flattenReleaseTree", () => {
  const tree = node("root", {}, [
    node("released", {}, [node("released-child")]),
    node("parent", {}, [node("unreleased", { releaseStatus: "in progress" })]),
  ]);

  it("lists all instances depth first with their level", () => {
    const entries = flattenReleaseTree(tree, {}, false);

    expect(ids(entries)).toEqual([
      "root",
      "released",
      "released-child",
      "parent",
      "unreleased",
    ]);
    expect(entries.map((e) => e.level)).toEqual([0, 1, 2, 1, 2]);
  });

  it("hides the parts of the tree which are released entirely", () => {
    expect(ids(flattenReleaseTree(tree, {}, true))).toEqual([
      "root",
      "parent",
      "unreleased",
    ]);
  });

  it("keeps released instances with a pending action when hiding released ones", () => {
    expect(
      ids(flattenReleaseTree(tree, { "released-child": "unrelease" }, true)),
    ).toEqual(["root", "released", "released-child", "parent", "unreleased"]);
  });
});
