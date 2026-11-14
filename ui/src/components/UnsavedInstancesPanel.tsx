import React, { useEffect, useRef, useState } from "react";
import { Button, Form, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faCircle,
  faFloppyDisk,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../contexts/AuthContext";
import { useInstances } from "../contexts/InstancesContext";
import {
  UnsavedInstanceDraft,
  useUnsavedInstances,
} from "../contexts/UnsavedInstancesContext";
import DirLinkIcon from "../assets/icons/DirLink.svg";
import RevLinkIcon from "../assets/icons/RevLink.svg";
import RevDirLinkIcon from "../assets/icons/RevDirLink.svg";
import NoLinksIcon from "../assets/icons/NoLinks.svg";
import UnsavedActionDialog, { linkedInstanceIds, orderDraftsForSave } from "./UnsavedActionDialog";
import { isCreatedInstance, persistUnsavedDraft } from "./persistUnsavedDraft";
import "./UnsavedInstancesPanel.css";

const typeColors: Record<string, string> = {
  Appliance: "#ff9800",
  "Asset Tag": "#9c27b0",
  Blade: "#2196f3",
  Building: "#4caf50",
  Cabinet: "#f44336",
  Canton: "#00bcd4",
};

type UnsavedInstancesPanelProps = {
  currentInstanceId?: string;
  onDiscardCurrent?: () => void;
  /** Saves the instance that is open. Other drafts are saved from the rail. */
  onSaveCurrent?: () => Promise<void>;
};

function linkStatus(draft: UnsavedInstanceDraft, drafts: UnsavedInstanceDraft[]) {
  const outgoing = linkedInstanceIds(draft).length > 0;
  const incoming =
    draft.hasReverseLinks === true ||
    drafts.some(
      (other) =>
        other.instanceId !== draft.instanceId &&
        linkedInstanceIds(other).includes(draft.instanceId),
    );
  if (outgoing && incoming) {
    return { src: RevDirLinkIcon, label: "Incoming and outgoing links" };
  }
  if (outgoing) {
    return { src: DirLinkIcon, label: "Outgoing links" };
  }
  if (incoming) {
    return { src: RevLinkIcon, label: "Incoming links" };
  }
  return { src: NoLinksIcon, label: "No links" };
}

type PendingAction = {
  action: "save" | "cancel";
  /** Instances still included in the save or cancel. */
  instanceIds: string[];
  /** Instances shown in the dialog, including ones left out. */
  offeredIds: string[];
  scope: "one" | "selected" | "all";
};

export default function UnsavedInstancesPanel({
  currentInstanceId,
  onDiscardCurrent,
  onSaveCurrent,
}: UnsavedInstancesPanelProps) {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { addInstance, instances } = useInstances();
  const { drafts, removeDraft } = useUnsavedInstances();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const savingRef = useRef(new Set<string>());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const canSelect = drafts.length > 1;
  const selectedCount = drafts.filter((draft) => selectedIds.has(draft.instanceId)).length;
  const allSelected = canSelect && selectedCount === drafts.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const selectedSaving = drafts.some(
    (draft) => selectedIds.has(draft.instanceId) && savingIds.has(draft.instanceId),
  );

  useEffect(() => {
    setSelectedIds((current) => {
      const live = new Set(drafts.map((draft) => draft.instanceId));
      let changed = false;
      const next = new Set<string>();
      current.forEach((instanceId) => {
        if (live.has(instanceId)) {
          next.add(instanceId);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [drafts]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const handleOpen = (draft: UnsavedInstanceDraft) => {
    if (draft.isNew && draft.typeIdentifier) {
      navigate(
        `/editor/instances/${draft.instanceId}?new=1&type=${encodeURIComponent(draft.typeIdentifier)}`,
      );
      return;
    }
    navigate(`/editor/instances/${draft.instanceId}`);
  };

  const handleDiscard = (instanceId: string) => {
    removeDraft(instanceId);
    setSaveErrors((previous) => {
      if (!previous[instanceId]) {
        return previous;
      }
      const next = { ...previous };
      delete next[instanceId];
      return next;
    });

    if (instanceId === currentInstanceId) {
      onDiscardCurrent?.();
    }
  };

  const saveDraft = async (draft: UnsavedInstanceDraft) => {
    const token = await getAccessToken();
    const stored = await persistUnsavedDraft(token, draft);
    if (draft.isNew && isCreatedInstance(stored)) {
      addInstance({
        id: instances.length + 1,
        instanceId: stored.instanceId,
        type: stored.type,
        typeColor: stored.typeColor,
        instanceName: stored.instanceName,
        space: stored.space,
        permissions: stored.permissions,
        favorite: false,
        contributed: true,
        releaseStatus: stored.releaseStatus,
      });
    }
  };

  const handleSave = (draft: UnsavedInstanceDraft): Promise<void> => {
    if (savingRef.current.has(draft.instanceId)) {
      return Promise.resolve();
    }
    savingRef.current.add(draft.instanceId);
    setSavingIds(new Set(savingRef.current));
    setSaveErrors((previous) => {
      if (!previous[draft.instanceId]) {
        return previous;
      }
      const next = { ...previous };
      delete next[draft.instanceId];
      return next;
    });
    const request =
      draft.instanceId === currentInstanceId && onSaveCurrent
        ? onSaveCurrent()
        : saveDraft(draft).then(() => removeDraft(draft.instanceId));
    return request
      .catch((e: unknown) => {
        setSaveErrors((previous) => ({
          ...previous,
          [draft.instanceId]: e instanceof Error ? e.message : String(e),
        }));
      })
      .finally(() => {
        savingRef.current.delete(draft.instanceId);
        setSavingIds(new Set(savingRef.current));
      });
  };

  const toggleSelected = (instanceId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(instanceId)) {
        next.delete(instanceId);
      } else {
        next.add(instanceId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      allSelected ? new Set() : new Set(drafts.map((draft) => draft.instanceId)),
    );
  };

  const selectedDrafts = drafts.filter((draft) => selectedIds.has(draft.instanceId));
  const bulkScope = allSelected ? "all" : "selected";
  const saveLabel = `Save ${bulkScope} (${selectedCount})`;
  const cancelLabel = `Cancel ${bulkScope} (${selectedCount})`;
  const openAction = (
    action: PendingAction["action"],
    instanceIds: string[],
    scope: PendingAction["scope"],
  ) => {
    setPendingAction({ action, instanceIds, offeredIds: instanceIds, scope });
  };
  const togglePending = (instanceId: string) => {
    setPendingAction((current) => {
      if (!current) {
        return current;
      }
      const included = current.instanceIds.includes(instanceId);
      return {
        ...current,
        instanceIds: included
          ? current.instanceIds.filter((id) => id !== instanceId)
          : [...current.instanceIds, instanceId],
      };
    });
    if (pendingAction?.offeredIds.includes(instanceId)) {
      toggleSelected(instanceId);
    }
  };

  const handleConfirmAction = () => {
    const ids = new Set(pendingAction?.instanceIds ?? []);
    const targets = drafts.filter(
      (draft) => ids.has(draft.instanceId) && !savingIds.has(draft.instanceId),
    );
    if (pendingAction?.action === "save") {
      const ordered = orderDraftsForSave(drafts, [...ids]);
      void ordered.reduce(
        (previous, draft) => previous.then(() => handleSave(draft)),
        Promise.resolve(),
      );
    } else {
      targets.forEach((draft) => handleDiscard(draft.instanceId));
    }
    setPendingAction(null);
  };

  return (
    <aside
      className={`unsaved-instances-panel ${isExpanded ? "expanded" : "collapsed"}`}
      aria-label="Unsaved instances"
    >
      <div className="unsaved-instances-panel-shell">
        <div className="unsaved-instances-panel-header">
          {isExpanded && (
            <>
              <div>
                <h3 className="unsaved-instances-panel-title">
                  Unsaved Instances
                </h3>
                <p className="unsaved-instances-panel-subtitle">
                  Draft edits you have not saved yet
                </p>
              </div>
              <span className="unsaved-instances-panel-count">{drafts.length}</span>
            </>
          )}

          <div className="unsaved-instances-panel-toggle-group">
            <Button
              variant="link"
              size="sm"
              className="unsaved-instances-panel-toggle"
              onClick={() => setIsExpanded((previous) => !previous)}
              aria-expanded={isExpanded}
              aria-controls="unsaved-instances-panel-list"
              title={isExpanded ? "Collapse panel" : "Expand panel"}
              aria-label={
                isExpanded
                  ? "Collapse unsaved instances panel"
                  : `Expand unsaved instances panel${drafts.length > 0 ? `, ${drafts.length} unsaved` : ""}`
              }
            >
              <FontAwesomeIcon
                icon={isExpanded ? faChevronRight : faChevronLeft}
              />
            </Button>
            {!isExpanded && drafts.length > 0 && (
              <span
                className="unsaved-instances-panel-collapsed-count"
                aria-hidden="true"
              >
                {drafts.length}
              </span>
            )}
          </div>
        </div>

        {isExpanded && (
          <>
            <div
              id="unsaved-instances-panel-list"
              className="unsaved-instances-panel-list"
            >
              {drafts.length === 0 ? (
                <output className="unsaved-instances-panel-empty">
                  No unsaved instances. Edit an instance and your draft will appear
                  here while you work across multiple instances.
                </output>
              ) : (
                <>
                  {canSelect && (
                    <div className="unsaved-instances-panel-bulk">
                      <Form.Check
                        type="checkbox"
                        id="unsaved-instances-select-all"
                        className="unsaved-instances-panel-select-all"
                        label="Select all"
                        checked={allSelected}
                        ref={selectAllRef}
                        onChange={toggleSelectAll}
                      />
                    </div>
                  )}
                  {drafts.map((draft) => {
                    const typeColor = typeColors[draft.type] || "#6c757d";
                    const isCurrent = draft.instanceId === currentInstanceId;
                    const saving = savingIds.has(draft.instanceId);
                    const status = linkStatus(draft, drafts);

                    return (
                      <div
                        key={draft.instanceId}
                        className={`unsaved-instances-panel-item${
                          canSelect ? " unsaved-instances-panel-item--selectable" : ""
                        }`}
                      >
                        <div className="unsaved-instances-panel-item-row">
                          {canSelect && (
                            <Form.Check
                              type="checkbox"
                              className="unsaved-instances-panel-item-check"
                              aria-label={`Select ${draft.instanceName}`}
                              checked={selectedIds.has(draft.instanceId)}
                              disabled={saving}
                              onChange={() => toggleSelected(draft.instanceId)}
                            />
                          )}
                          <button
                            type="button"
                            className="unsaved-instances-panel-item-main"
                            onClick={() => handleOpen(draft)}
                            aria-current={isCurrent ? "true" : undefined}
                          >
                            <div className="unsaved-instances-panel-item-body">
                            <div className="unsaved-instances-panel-item-type">
                              <FontAwesomeIcon
                                icon={faCircle}
                                className="unsaved-instances-panel-item-type-dot"
                                style={
                                  { "--unsaved-type-color": typeColor } as React.CSSProperties
                                }
                                aria-hidden="true"
                              />
                              <span className="unsaved-instances-panel-item-type-name">
                                {draft.type}
                              </span>
                            </div>
                            <div className="unsaved-instances-panel-item-name">
                              {draft.instanceName}
                            </div>
                            <div className="unsaved-instances-panel-item-meta">
                              {isCurrent ? "Currently open" : "Click to open draft"}
                              {draft.changedFieldLabels &&
                                draft.changedFieldLabels.length > 0 && (
                                  <span className="unsaved-instances-panel-item-changed-fields">
                                    {" "}
                                    · Changed: {draft.changedFieldLabels.join(", ")}
                                  </span>
                                )}
                            </div>
                            </div>
                            <div className="unsaved-instances-panel-item-aside">
                              <span className="unsaved-instances-panel-item-badge">
                                {draft.isNew ? "New" : "Draft"}
                              </span>
                              <img
                                src={status.src}
                                alt={status.label}
                                title={status.label}
                                className="unsaved-instances-panel-link-status"
                              />
                            </div>
                          </button>
                          <div className="unsaved-instances-panel-item-actions">
                            <Button
                              type="button"
                              variant="link"
                              className="unsaved-instances-panel-save-btn"
                              onClick={() => openAction("save", [draft.instanceId], "one")}
                              disabled={saving}
                              aria-busy={saving}
                              aria-label={`Save ${draft.instanceName}`}
                              title="Save"
                            >
                              {saving ? (
                                <Spinner animation="border" size="sm" role="status" />
                              ) : (
                                <FontAwesomeIcon icon={faFloppyDisk} />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="link"
                              className="unsaved-instances-panel-discard-btn"
                              onClick={() => openAction("cancel", [draft.instanceId], "one")}
                              disabled={saving}
                              aria-label={`Cancel changes for ${draft.instanceName}`}
                              title="Cancel changes"
                            >
                              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                        {saveErrors[draft.instanceId] && (
                          <p className="unsaved-instances-panel-item-error" role="alert">
                            {saveErrors[draft.instanceId]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            {canSelect && selectedCount > 0 && (
              <div className="unsaved-instances-panel-actions">
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  className="unsaved-instances-panel-cancel"
                  onClick={() =>
                    openAction(
                      "cancel",
                      selectedDrafts.map((draft) => draft.instanceId),
                      allSelected ? "all" : "selected",
                    )
                  }
                  disabled={selectedSaving}
                >
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                  {cancelLabel}
                </Button>
                <Button
                  type="button"
                  variant="outline-dark"
                  size="sm"
                  className="unsaved-instances-panel-save-all"
                  onClick={() =>
                    openAction(
                      "save",
                      selectedDrafts.map((draft) => draft.instanceId),
                      allSelected ? "all" : "selected",
                    )
                  }
                  disabled={selectedSaving}
                  aria-busy={selectedSaving}
                >
                  {selectedSaving ? (
                    <Spinner animation="border" size="sm" role="status" />
                  ) : (
                    <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
                  )}
                  {saveLabel}
                </Button>
              </div>
            )}
          </>
        )}

        {!isExpanded && (
          <div className="unsaved-instances-panel-collapsed-label">
            Unsaved
          </div>
        )}
      </div>
      <UnsavedActionDialog
        show={pendingAction !== null}
        action={pendingAction?.action ?? "save"}
        scope={pendingAction?.scope ?? "one"}
        drafts={drafts}
        offeredIds={pendingAction?.offeredIds ?? []}
        includedIds={pendingAction?.instanceIds ?? []}
        saveErrors={saveErrors}
        onToggle={togglePending}
        onDismiss={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
      />
    </aside>
  );
}
