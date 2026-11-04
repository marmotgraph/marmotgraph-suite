import { ReleaseNode } from "../../services/instances";
import { ReleaseStatus } from "./editorMockData";

/** What is done with an instance of the release tree when proceeding */
export type ReleaseAction = "release" | "unrelease" | "none";

/** The actions chosen for the instances of the release tree (by instanceId) - instances without one are left as they are */
export type PendingActions = Record<string, ReleaseAction>;

/** An instance of the release tree as listed - with its depth in the tree */
export interface ReleaseListEntry {
  node: ReleaseNode;
  level: number;
}

export interface ReleaseStats {
  total: number;
  current: Record<ReleaseStatus, number>;
  /** The release status of the instances after proceeding with the pending actions */
  after: Record<ReleaseStatus, number>;
  toRelease: number;
  toUnrelease: number;
}

/** A release / unrelease to be carried out when proceeding */
export interface ReleaseOperation {
  node: ReleaseNode;
  action: Exclude<ReleaseAction, "none">;
}

const compareNodes = (a: ReleaseNode, b: ReleaseNode) =>
  a.type.localeCompare(b.type, undefined, { sensitivity: "base" }) ||
  a.instanceName.localeCompare(b.instanceName, undefined, {
    sensitivity: "base",
  });

/**
 * Sorts the children of every instance by type and name - and lists every instance only once (an instance can be
 * reached by several paths of the scope): only its first occurrence (from the top of the tree) is kept.
 */
export function prepareReleaseTree(root: ReleaseNode): ReleaseNode {
  const seen = new Set<string>([root.instanceId]);
  const prepare = (node: ReleaseNode): ReleaseNode => {
    const children = [...node.children]
      .sort(compareNodes)
      .filter((child) => {
        if (seen.has(child.instanceId)) {
          return false;
        }
        seen.add(child.instanceId);
        return true;
      });
    return { ...node, children: children.map(prepare) };
  };
  return prepare(root);
}

/** The actions available for an instance - depending on its release status and the permissions of the user */
export function availableActions(node: ReleaseNode): ReleaseAction[] {
  const actions: ReleaseAction[] = [];
  if (node.canRelease && node.releaseStatus !== "released") {
    actions.push("release");
  }
  actions.push("none");
  if (node.canUnrelease && node.releaseStatus !== "in progress") {
    actions.push("unrelease");
  }
  return actions;
}

export function pendingAction(
  node: ReleaseNode,
  pending: PendingActions,
): ReleaseAction {
  return pending[node.instanceId] ?? "none";
}

/** The release status of the instance after proceeding with its pending action */
export function pendingStatus(
  node: ReleaseNode,
  pending: PendingActions,
): ReleaseStatus {
  switch (pendingAction(node, pending)) {
    case "release":
      return "released";
    case "unrelease":
      return "in progress";
    default:
      return node.releaseStatus;
  }
}

function forEachNode(
  node: ReleaseNode,
  callback: (node: ReleaseNode) => void,
) {
  callback(node);
  node.children.forEach((child) => forEachNode(child, callback));
}

/** Chooses the action for all instances of the tree for which it is available - the other ones are left as they are. */
export function markAll(
  root: ReleaseNode,
  action: Exclude<ReleaseAction, "none">,
): PendingActions {
  const pending: PendingActions = {};
  forEachNode(root, (node) => {
    if (availableActions(node).includes(action)) {
      pending[node.instanceId] = action;
    }
  });
  return pending;
}

const emptyCounts = (): Record<ReleaseStatus, number> => ({
  released: 0,
  "has changed": 0,
  "in progress": 0,
});

export function releaseStats(
  root: ReleaseNode,
  pending: PendingActions,
): ReleaseStats {
  const stats: ReleaseStats = {
    total: 0,
    current: emptyCounts(),
    after: emptyCounts(),
    toRelease: 0,
    toUnrelease: 0,
  };
  forEachNode(root, (node) => {
    stats.total++;
    stats.current[node.releaseStatus]++;
    stats.after[pendingStatus(node, pending)]++;
    const action = pendingAction(node, pending);
    if (action === "release") {
      stats.toRelease++;
    } else if (action === "unrelease") {
      stats.toUnrelease++;
    }
  });
  return stats;
}

/**
 * Whether the instance or any instance below it is not released (in its current state) or has a pending action - the
 * other parts of the tree can be hidden.
 */
function needsAttention(node: ReleaseNode, pending: PendingActions): boolean {
  return (
    node.releaseStatus !== "released" ||
    pendingAction(node, pending) !== "none" ||
    node.children.some((child) => needsAttention(child, pending))
  );
}

/**
 * The instances of the tree in the order they are listed (depth first) - optionally without the parts of the tree which
 * are released entirely (and are left as they are).
 */
export function flattenReleaseTree(
  root: ReleaseNode,
  pending: PendingActions,
  hideReleased: boolean,
): ReleaseListEntry[] {
  const entries: ReleaseListEntry[] = [];
  const visit = (node: ReleaseNode, level: number) => {
    if (hideReleased && !needsAttention(node, pending)) {
      return;
    }
    entries.push({ node, level });
    node.children.forEach((child) => visit(child, level + 1));
  };
  visit(root, 0);
  return entries;
}

/**
 * The releases / unreleases to be carried out for the pending actions - all releases (from the top of the tree) before
 * the unreleases. Actions which are not available (anymore) are skipped.
 */
export function pendingOperations(
  root: ReleaseNode,
  pending: PendingActions,
): ReleaseOperation[] {
  const releases: ReleaseOperation[] = [];
  const unreleases: ReleaseOperation[] = [];
  forEachNode(root, (node) => {
    const action = pendingAction(node, pending);
    if (action === "none" || !availableActions(node).includes(action)) {
      return;
    }
    (action === "release" ? releases : unreleases).push({ node, action });
  });
  return [...releases, ...unreleases];
}
