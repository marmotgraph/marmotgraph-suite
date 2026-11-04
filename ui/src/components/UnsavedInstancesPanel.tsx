import React, { useEffect, useRef, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faCircle,
  faFloppyDisk,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../contexts/AuthContext";
import { useInstances } from "../contexts/InstancesContext";
import {
  UnsavedInstanceDraft,
  useUnsavedInstances,
} from "../contexts/UnsavedInstancesContext";
import { getChangedInstanceFieldKeys } from "../modules/editor/editorMockData";
import {
  createInstance,
  replaceRawInstance,
  updateInstance,
} from "../services/instances";
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

type PendingAction = {
  action: "save" | "cancel";
  /** Instances still included in the save or cancel. */
  instanceIds: string[];
  /** Instances shown in the dialog, including ones left out. */
  offeredIds: string[];
  scope: "one" | "selected" | "all";
};

type ChangeSummary = {
  label: string;
  detail?: string;
};

function formatChangeValue(value: unknown): string {
  if (value == null || value === "") {
    return "Empty";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") {
          return String(item);
        }
        if (item && typeof item === "object" && "instanceName" in item) {
          const name = (item as { instanceName?: unknown }).instanceName;
          return typeof name === "string" ? name : "";
        }
        return "";
      })
      .filter((part) => part !== "");
    return parts.length > 0 ? parts.join(", ") : `${value.length} values`;
  }
  return "Updated";
}

function changeSummary(draft: UnsavedInstanceDraft): ChangeSummary[] {
  if (draft.rawJson !== undefined) {
    return [{ label: "Raw JSON", detail: "The whole document will be replaced" }];
  }
  const hasBaseline = draft.baseline !== undefined;
  const keys = hasBaseline
    ? getChangedInstanceFieldKeys(draft.fieldValues, draft.baseline ?? {})
    : Object.keys(draft.fieldValues);
  const labels = draft.changedFieldLabels ?? [];
  if (keys.length === 0) {
    return labels.map((label) => ({ label }));
  }
  const labeled = labels.length === keys.length;
  return keys.map((key, index) => {
    const label = labeled ? labels[index] : key;
    const next = formatChangeValue(draft.fieldValues[key]);
    if (!hasBaseline) {
      return { label, detail: next };
    }
    const previous = formatChangeValue(draft.baseline?.[key]);
    return previous === next ? { label } : { label, detail: `${previous} → ${next}` };
  });
}

type DraftNotice = {
  message: string;
  /** Save stays disabled while an included instance has a notice like this. */
  blocksSave: boolean;
};

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function draftNotices(
  draft: UnsavedInstanceDraft,
  action: PendingAction["action"],
  saveError?: string,
): DraftNotice[] {
  const notices: DraftNotice[] = [];
  if (saveError) {
    notices.push({ message: saveError, blocksSave: false });
  }
  if (draft.rawJson !== undefined) {
    try {
      parseRawInstance(draft.rawJson);
    } catch (error) {
      notices.push({
        message: error instanceof Error ? error.message : "The raw JSON is not a valid object.",
        blocksSave: action === "save",
      });
    }
    if (action === "save") {
      notices.push({ message: "Saving replaces the whole stored document.", blocksSave: false });
    }
  } else if (draft.isNew && !draft.typeIdentifier) {
    notices.push({
      message:
        action === "save"
          ? "Open this instance to save it. Its type is missing."
          : "This instance has not been stored yet. Cancel removes the draft.",
      blocksSave: action === "save",
    });
  } else if (draft.isNew && action === "cancel") {
    notices.push({
      message: "This instance has not been stored yet. Cancel removes the draft.",
      blocksSave: false,
    });
  }
  if (draft.rawJson === undefined && draft.baseline) {
    changeSummary(draft)
      .filter((change) => change.detail?.endsWith("→ Empty"))
      .forEach((change) => {
        notices.push({ message: `${change.label} will be cleared.`, blocksSave: false });
      });
  }
  return notices;
}

function changedFields(draft: UnsavedInstanceDraft): Record<string, unknown> {
  const baseline = draft.baseline ?? {};
  const keys = draft.baseline
    ? getChangedInstanceFieldKeys(draft.fieldValues, baseline)
    : Object.keys(draft.fieldValues);
  return Object.fromEntries(keys.map((key) => [key, draft.fieldValues[key] ?? null]));
}

function parseRawInstance(rawJson: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("The instance needs to be a valid JSON object.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("The instance needs to be a valid JSON object.");
  }
  return parsed as Record<string, unknown>;
}

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
    if (draft.rawJson !== undefined) {
      await replaceRawInstance(token, draft.instanceId, parseRawInstance(draft.rawJson));
      return;
    }
    const changes = changedFields(draft);
    if (draft.isNew) {
      if (!draft.typeIdentifier) {
        throw new Error("Open this instance to save it.");
      }
      const stored = await createInstance(
        token,
        draft.instanceId,
        draft.typeIdentifier,
        changes,
        draft.space,
      );
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
      return;
    }
    await updateInstance(token, draft.instanceId, changes);
  };

  const handleSave = (draft: UnsavedInstanceDraft) => {
    if (savingRef.current.has(draft.instanceId)) {
      return;
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
    request
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
  const offeredDrafts = pendingAction
    ? drafts.filter((draft) => pendingAction.offeredIds.includes(draft.instanceId))
    : [];
  const pendingDrafts = offeredDrafts.filter((draft) =>
    pendingAction?.instanceIds.includes(draft.instanceId),
  );
  const choosing = (pendingAction?.offeredIds.length ?? 0) > 1;
  const pendingNotices = pendingAction
    ? pendingDrafts.flatMap((draft) =>
        draftNotices(draft, pendingAction.action, saveErrors[draft.instanceId]).map((notice) => ({
          ...notice,
          instanceId: draft.instanceId,
          instanceName: draft.instanceName,
        })),
      )
    : [];
  const blockingNotices = pendingNotices.filter((notice) => notice.blocksSave);
  const changeCount = pendingAction
    ? pendingDrafts.reduce((total, draft) => total + changeSummary(draft).length, 0)
    : 0;
  const createdCount = pendingAction?.action === "save"
    ? pendingDrafts.filter(
        (draft) =>
          draft.isNew &&
          !draftNotices(draft, "save", saveErrors[draft.instanceId]).some((notice) => notice.blocksSave),
      ).length
    : 0;
  const instanceSummary =
    choosing && pendingDrafts.length !== offeredDrafts.length
      ? `${pendingDrafts.length} of ${offeredDrafts.length} instances`
      : countLabel(pendingDrafts.length, "instance", "instances");
  const confirmScope: PendingAction["scope"] = !choosing
    ? pendingAction?.scope ?? "one"
    : pendingDrafts.length > 1 && pendingDrafts.length === drafts.length
      ? "all"
      : pendingDrafts.length > 1
        ? "selected"
        : "one";
  const actionTitle =
    pendingAction?.action === "save"
      ? confirmScope === "all"
        ? "Save all changes?"
        : confirmScope === "selected"
          ? "Save selected changes?"
          : "Save these changes?"
      : confirmScope === "all"
        ? "Cancel all unsaved changes?"
        : confirmScope === "selected"
          ? "Cancel selected changes?"
          : "Cancel unsaved changes?";
  const actionConfirmLabel =
    pendingAction?.action === "save"
      ? confirmScope === "all"
        ? "Save all"
        : confirmScope === "selected"
          ? "Save selected"
          : "Save"
      : confirmScope === "all"
        ? "Cancel all"
        : confirmScope === "selected"
          ? "Cancel selected"
          : "Cancel changes";

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
    toggleSelected(instanceId);
  };

  const handleConfirmAction = () => {
    const ids = new Set(pendingAction?.instanceIds ?? []);
    const targets = drafts.filter(
      (draft) => ids.has(draft.instanceId) && !savingIds.has(draft.instanceId),
    );
    if (pendingAction?.action === "save") {
      targets.forEach(handleSave);
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
                <div className="unsaved-instances-panel-empty" role="status">
                  No unsaved instances. Edit an instance and your draft will appear
                  here while you work across multiple instances.
                </div>
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
                              <span className="unsaved-instances-panel-item-badge">
                                {draft.isNew ? "New" : "Draft"}
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
      <Modal
        show={pendingAction !== null}
        onHide={() => setPendingAction(null)}
        centered
        animation={false}
        dialogClassName="unsaved-action-dialog"
        aria-labelledby="unsaved-action-title"
        aria-describedby="unsaved-action-description"
      >
        <Modal.Header closeButton>
          <Modal.Title id="unsaved-action-title">{actionTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body id="unsaved-action-description">
          <p className="unsaved-action-summary">
            <span>{instanceSummary}</span>
            <span aria-hidden="true"> · </span>
            <span>{countLabel(changeCount, "change", "changes")}</span>
          </p>
          <p className="unsaved-action-intro">
            {pendingAction?.action === "save"
              ? "These changes will be saved."
              : "These changes will be dropped. The instances are not deleted."}
          </p>
          {createdCount > 0 && (
            <p className="unsaved-action-note">
              {countLabel(createdCount, "instance", "instances")} will be created.
            </p>
          )}
          {pendingNotices.length > 0 && (
            <ul className="unsaved-action-issues">
              {pendingNotices.map((notice) => (
                <li key={`${notice.instanceId}-${notice.message}`}>
                  <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
                  <span>
                    {pendingDrafts.length > 1 ? `${notice.instanceName}: ` : ""}
                    {notice.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {choosing && pendingDrafts.length === 0 && (
            <p className="unsaved-action-empty" role="status">
              Choose at least one instance.
            </p>
          )}
          <ul className="unsaved-action-cards">
            {offeredDrafts.map((draft) => {
              const included = pendingAction?.instanceIds.includes(draft.instanceId) ?? false;
              const changes = changeSummary(draft);
              const notices =
                included && pendingAction
                  ? draftNotices(draft, pendingAction.action, saveErrors[draft.instanceId])
                  : [];
              const typeColor = typeColors[draft.type] || "#6c757d";
              return (
                <li key={draft.instanceId} className="unsaved-action-row">
                  {choosing && (
                    <Form.Check
                      type="checkbox"
                      className="unsaved-action-include"
                      aria-label={`Include ${draft.instanceName}`}
                      checked={included}
                      onChange={() => togglePending(draft.instanceId)}
                    />
                  )}
                  <div
                    className={`unsaved-action-card${included ? "" : " unsaved-action-card--out"}`}
                  >
                    <div className="unsaved-action-identity">
                      <div className="unsaved-action-type">
                        <FontAwesomeIcon
                          icon={faCircle}
                          className="unsaved-action-type-dot"
                          style={{ "--unsaved-type-color": typeColor } as React.CSSProperties}
                          aria-hidden="true"
                        />
                        <span>{draft.type}</span>
                      </div>
                      <div className="unsaved-action-name">{draft.instanceName}</div>
                      <div className="unsaved-action-id" title={draft.instanceId}>
                        {draft.instanceId}
                        {draft.space ? ` · ${draft.space}` : ""}
                      </div>
                      <div className="unsaved-action-count">
                        {countLabel(changes.length, "change", "changes")}
                      </div>
                      {!included && <div className="unsaved-action-skipped">Not included</div>}
                    </div>
                  {changes.length > 0 && (
                    <ul className="unsaved-action-changes">
                      {changes.map((change) => (
                        <li key={`${draft.instanceId}-${change.label}`}>
                          <span className="unsaved-action-change-label">{change.label}</span>
                          {change.detail && (
                            <span className="unsaved-action-change-detail">{change.detail}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {notices.length > 0 && (
                    <ul className="unsaved-action-card-issues">
                      {notices.map((notice) => (
                        <li key={notice.message}>{notice.message}</li>
                      ))}
                    </ul>
                  )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setPendingAction(null)}>
            Keep editing
          </Button>
          <span
            title={
              pendingDrafts.length === 0
                ? "Choose at least one instance"
                : blockingNotices.length > 0
                  ? blockingNotices[0].message
                  : undefined
            }
          >
            <Button
              variant="dark"
              className="unsaved-instances-panel-confirm"
              onClick={handleConfirmAction}
              disabled={pendingDrafts.length === 0 || blockingNotices.length > 0}
            >
              <FontAwesomeIcon
                icon={pendingAction?.action === "save" ? faFloppyDisk : faXmark}
                aria-hidden="true"
              />
              {actionConfirmLabel}
            </Button>
          </span>
        </Modal.Footer>
      </Modal>
    </aside>
  );
}
