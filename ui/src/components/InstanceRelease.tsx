import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  ButtonGroup,
  Form,
  ProgressBar,
  Spinner,
} from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBan,
  faCheck,
  faCircle,
  faCircleDot,
  faHourglassHalf,
  faLinkSlash,
  faPenToSquare,
  faRocket,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchReleaseTree,
  ReleaseNode,
  releaseInstance,
  unreleaseInstance,
} from "../services/instances";
import { ReleaseStatus } from "../modules/editor/editorMockData";
import {
  availableActions,
  flattenReleaseTree,
  markAll,
  pendingAction,
  PendingActions,
  pendingOperations,
  pendingStatus,
  prepareReleaseTree,
  ReleaseAction,
  ReleaseOperation,
  releaseStats,
  ReleaseStats,
} from "../modules/editor/releaseTree";
import "./InstanceRelease.css";

const RELEASE_STATUSES: ReleaseStatus[] = [
  "released",
  "has changed",
  "in progress",
];

const STATUS_STYLES: Record<
  ReleaseStatus,
  { modifier: string; icon: IconDefinition }
> = {
  released: { modifier: "released", icon: faRocket },
  "has changed": { modifier: "changed", icon: faPenToSquare },
  "in progress": { modifier: "progress", icon: faHourglassHalf },
};

const ACTIONS: Array<{
  action: ReleaseAction;
  icon: IconDefinition;
  title: string;
}> = [
  { action: "release", icon: faCheck, title: "Release" },
  { action: "none", icon: faCircleDot, title: "Leave as it is" },
  { action: "unrelease", icon: faLinkSlash, title: "Unrelease" },
];

interface ReleaseError {
  operation: ReleaseOperation;
  message: string;
}

/** The state of the releases / unreleases carried out when proceeding */
interface ReleaseProgress {
  total: number;
  done: number;
  running: boolean;
  stopped: boolean;
  current?: ReleaseOperation;
  errors: ReleaseError[];
}

/**
 * Shows the release tree of an instance (the instances in the scope of its type) with the release status of every
 * instance. The user chooses what to do with each instance (release, unrelease, leave as it is) - the chosen actions
 * are carried out one after the other when proceeding.
 */
export default function InstanceRelease({
  instanceId,
  onInstanceClick,
}: {
  instanceId: string;
  /** Called when the name of an instance of the tree is clicked */
  onInstanceClick: (instanceId: string) => void;
}) {
  const { getAccessToken } = useAuth();
  const [tree, setTree] = useState<ReleaseNode>();
  const [loadError, setLoadError] = useState<string>();
  /** Incremented to reload the tree (after proceeding) */
  const [reloadCount, setReloadCount] = useState(0);
  const [pending, setPending] = useState<PendingActions>({});
  const [hideReleased, setHideReleased] = useState(false);
  const [progress, setProgress] = useState<ReleaseProgress>();
  const stopRequested = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then((token) => fetchReleaseTree(token, instanceId))
      .then((loaded) => {
        if (!cancelled) {
          setTree(prepareReleaseTree(loaded));
          setPending({});
          setLoadError(undefined);
        }
      })
      .catch((e: unknown) => {
        console.error("Failed to load the release tree", e);
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, instanceId, reloadCount]);

  // Pending releases are not continued once the view is left
  useEffect(
    () => () => {
      stopRequested.current = true;
    },
    [],
  );

  const entries = useMemo(
    () => (tree ? flattenReleaseTree(tree, pending, hideReleased) : []),
    [tree, pending, hideReleased],
  );
  const stats = useMemo(
    () => (tree ? releaseStats(tree, pending) : undefined),
    [tree, pending],
  );

  if (loadError && !tree) {
    return (
      <Alert variant="danger">
        {loadError}
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline-danger"
            onClick={() => {
              setLoadError(undefined);
              setReloadCount((count) => count + 1);
            }}
          >
            Retry
          </Button>
        </div>
      </Alert>
    );
  }

  if (!tree || !stats) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" role="status" className="me-2" />
        Loading release tree...
      </div>
    );
  }

  const running = progress?.running ?? false;
  const hasPending = stats.toRelease + stats.toUnrelease > 0;

  const setAction = (node: ReleaseNode, action: ReleaseAction) =>
    setPending((current) => {
      const next = { ...current };
      if (action === "none") {
        delete next[node.instanceId];
      } else {
        next[node.instanceId] = action;
      }
      return next;
    });

  const handleInstanceClick = (id: string) => {
    if (
      hasPending &&
      !window.confirm("Discard the pending release changes?")
    ) {
      return;
    }
    onInstanceClick(id);
  };

  const handleProceed = async () => {
    const operations = pendingOperations(tree, pending);
    if (operations.length === 0) {
      return;
    }
    stopRequested.current = false;
    const errors: ReleaseError[] = [];
    setProgress({
      total: operations.length,
      done: 0,
      running: true,
      stopped: false,
      errors,
    });
    for (const [index, operation] of operations.entries()) {
      if (stopRequested.current) {
        break;
      }
      setProgress((p) => p && { ...p, current: operation });
      try {
        const token = await getAccessToken();
        const send =
          operation.action === "release" ? releaseInstance : unreleaseInstance;
        await send(token, operation.node.instanceId);
      } catch (e: unknown) {
        console.error(`Failed to ${operation.action} the instance`, e);
        errors.push({
          operation,
          message: e instanceof Error ? e.message : String(e),
        });
      }
      setProgress(
        (p) => p && { ...p, done: index + 1, errors: [...errors] },
      );
    }
    setProgress(
      (p) =>
        p && {
          ...p,
          running: false,
          stopped: stopRequested.current,
          current: undefined,
        },
    );
    setReloadCount((count) => count + 1);
  };

  return (
    <div className="instance-release">
      <ReleaseStatsPanel stats={stats} />

      <div className="instance-release-toolbar">
        <Form.Check
          type="switch"
          id="instance-release-hide-released"
          label="Hide released instances"
          checked={hideReleased}
          onChange={(e) => setHideReleased(e.target.checked)}
        />
        <div className="d-flex gap-2">
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => setPending(markAll(tree, "release"))}
            disabled={running}
            title="Release all instances you are allowed to release"
          >
            <FontAwesomeIcon icon={faCheck} className="me-1" />
            Release all
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => setPending({})}
            disabled={running || !hasPending}
            title="Leave all instances as they are"
          >
            <FontAwesomeIcon icon={faCircleDot} className="me-1" />
            Reset
          </Button>
        </div>
      </div>

      <ul className="release-tree" aria-label="Release tree">
        {entries.map(({ node, level }) => (
          <ReleaseTreeRow
            key={node.instanceId}
            node={node}
            level={level}
            pending={pending}
            isTop={node.instanceId === tree.instanceId}
            disabled={running}
            onActionChange={(action) => setAction(node, action)}
            onInstanceClick={handleInstanceClick}
          />
        ))}
        {entries.length === 0 && (
          <li className="release-tree-empty text-muted">
            All instances are released.
          </li>
        )}
      </ul>

      {progress && (
        <ReleaseProgressPanel
          progress={progress}
          onStop={() => {
            stopRequested.current = true;
          }}
          onDismiss={() => setProgress(undefined)}
        />
      )}

      <div className="d-flex align-items-center gap-3 mt-4">
        <Button
          variant="dark"
          onClick={handleProceed}
          disabled={running || !hasPending}
        >
          {running ? (
            <Spinner animation="border" size="sm" className="me-2" />
          ) : (
            <FontAwesomeIcon icon={faRocket} className="me-2" />
          )}
          Proceed
        </Button>
        <span className="text-muted small">
          {hasPending
            ? `${stats.toRelease} to release · ${stats.toUnrelease} to unrelease`
            : "No pending changes"}
        </span>
      </div>
    </div>
  );
}

function StatusTag({ status }: { status: ReleaseStatus }) {
  const { modifier, icon } = STATUS_STYLES[status];
  return (
    <span className={`release-status release-status--${modifier}`}>
      <FontAwesomeIcon icon={icon} className="me-1" />
      {status}
    </span>
  );
}

/** The share of the instances per release status - now and after proceeding. */
function ReleaseStatsPanel({ stats }: { stats: ReleaseStats }) {
  const rows: Array<[string, Record<ReleaseStatus, number>]> = [
    ["Now", stats.current],
    ["After proceeding", stats.after],
  ];
  return (
    <div className="release-stats">
      {rows.map(([label, counts]) => (
        <div key={label} className="release-stats-row">
          <span className="release-stats-label">{label}</span>
          <div
            className="release-stats-bar"
            role="img"
            aria-label={`${label}: ${RELEASE_STATUSES.map((s) => `${counts[s]} ${s}`).join(", ")}`}
          >
            {RELEASE_STATUSES.filter((s) => counts[s] > 0).map((status) => (
              <div
                key={status}
                className={`release-stats-segment release-stats-segment--${STATUS_STYLES[status].modifier}`}
                style={{ flexGrow: counts[status] }}
                title={`${counts[status]} ${status}`}
              />
            ))}
          </div>
          <span className="release-stats-counts">
            {RELEASE_STATUSES.map((status) => (
              <span key={status} title={status}>
                <FontAwesomeIcon
                  icon={faCircle}
                  className={`release-stats-dot release-stats-dot--${STATUS_STYLES[status].modifier}`}
                />
                {counts[status]}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReleaseTreeRow({
  node,
  level,
  pending,
  isTop,
  disabled,
  onActionChange,
  onInstanceClick,
}: {
  node: ReleaseNode;
  level: number;
  pending: PendingActions;
  isTop: boolean;
  disabled: boolean;
  onActionChange: (action: ReleaseAction) => void;
  onInstanceClick: (instanceId: string) => void;
}) {
  const action = pendingAction(node, pending);
  const available = availableActions(node);
  const after = pendingStatus(node, pending);
  return (
    <li
      className={`release-node release-node--${action}`}
      style={{ "--release-level": level } as React.CSSProperties}
    >
      <div className="release-node-status">
        <StatusTag status={node.releaseStatus} />
        {after !== node.releaseStatus && (
          <>
            <FontAwesomeIcon
              icon={faArrowRight}
              className="release-node-arrow"
              aria-label="becomes"
            />
            <StatusTag status={after} />
          </>
        )}
      </div>
      <div className="release-node-label">
        <span className="release-node-type">
          <FontAwesomeIcon
            icon={faCircle}
            className="me-1"
            style={{ color: node.typeColor || "#6c757d" }}
          />
          {node.type}
        </span>
        {isTop ? (
          <span className="release-node-name">{node.instanceName}</span>
        ) : (
          <Button
            variant="link"
            className="release-node-name release-node-name--link p-0"
            onClick={() => onInstanceClick(node.instanceId)}
            title={`Open ${node.instanceName}`}
          >
            {node.instanceName}
          </Button>
        )}
      </div>
      {!node.canRelease && !node.canUnrelease ? (
        <span
          className="release-node-forbidden"
          title="You are not allowed to release this instance"
          aria-label="You are not allowed to release this instance"
        >
          <FontAwesomeIcon icon={faBan} />
        </span>
      ) : (
        <ButtonGroup
          size="sm"
          className="release-node-actions"
          aria-label={`Release action for ${node.instanceName}`}
        >
          {ACTIONS.map(({ action: option, icon, title }) => (
            <Button
              key={option}
              variant="link"
              className={`release-node-action release-node-action--${option}${action === option ? " release-node-action--active" : ""}`}
              disabled={disabled || !available.includes(option)}
              onClick={() => onActionChange(option)}
              aria-pressed={action === option}
              aria-label={title}
              title={title}
            >
              <FontAwesomeIcon icon={icon} />
            </Button>
          ))}
        </ButtonGroup>
      )}
    </li>
  );
}

function ReleaseProgressPanel({
  progress,
  onStop,
  onDismiss,
}: {
  progress: ReleaseProgress;
  onStop: () => void;
  onDismiss: () => void;
}) {
  const percent = Math.round((progress.done / progress.total) * 100);
  if (progress.running) {
    return (
      <div className="release-progress" role="status">
        <ProgressBar animated now={percent} label={`${progress.done} / ${progress.total}`} />
        <div className="d-flex align-items-center justify-content-between mt-2">
          <span className="text-muted small text-truncate">
            {progress.current &&
              `${progress.current.action === "release" ? "Releasing" : "Unreleasing"} ${progress.current.node.instanceName}...`}
          </span>
          <Button size="sm" variant="outline-danger" onClick={onStop}>
            Stop
          </Button>
        </div>
      </div>
    );
  }
  const succeeded = progress.done - progress.errors.length;
  return (
    <Alert
      variant={progress.errors.length > 0 ? "danger" : "success"}
      className="mt-3 mb-0"
      dismissible
      onClose={onDismiss}
    >
      {succeeded} of {progress.total} changes carried out
      {progress.stopped && " (stopped)"}.
      {progress.errors.length > 0 && (
        <ul className="release-errors mb-0 mt-2">
          {progress.errors.map(({ operation, message }) => (
            <li key={operation.node.instanceId}>
              <strong>
                {operation.node.type} {operation.node.instanceName}
              </strong>
              : {message}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
