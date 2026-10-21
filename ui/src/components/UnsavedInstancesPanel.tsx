import React, { useEffect, useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faCircle,
  faFloppyDisk,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useUnsavedInstances } from "../contexts/UnsavedInstancesContext";
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
  onRequestSave: (instanceIds: string[]) => void;
  isSaving?: boolean;
};

export default function UnsavedInstancesPanel({
  currentInstanceId,
  onDiscardCurrent,
  onRequestSave,
  isSaving = false,
}: UnsavedInstancesPanelProps) {
  const navigate = useNavigate();
  const { drafts, removeDraft } = useUnsavedInstances();
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds((previous) =>
      previous.filter((instanceId) =>
        drafts.some((draft) => draft.instanceId === instanceId),
      ),
    );
  }, [drafts]);

  const allDraftIds = useMemo(
    () => drafts.map((draft) => draft.instanceId),
    [drafts],
  );
  const allSelected =
    drafts.length > 0 && selectedIds.length === drafts.length;
  const selectedCount = selectedIds.length;

  const handleOpen = (instanceId: string) => {
    navigate(`/editor/instance/${instanceId}`);
  };

  const handleDiscard = (instanceId: string) => {
    removeDraft(instanceId);

    if (instanceId === currentInstanceId) {
      onDiscardCurrent?.();
    }
  };

  const toggleSelected = (instanceId: string) => {
    setSelectedIds((previous) =>
      previous.includes(instanceId)
        ? previous.filter((id) => id !== instanceId)
        : [...previous, instanceId],
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : allDraftIds);
  };

  const handleSaveOne = (
    event: React.MouseEvent,
    instanceId: string,
  ) => {
    event.stopPropagation();
    onRequestSave([instanceId]);
  };

  const handleSaveSelected = () => {
    onRequestSave(selectedIds);
  };

  const handleSaveAll = () => {
    onRequestSave(allDraftIds);
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
            {drafts.length > 0 && (
              <div className="unsaved-instances-panel-toolbar">
                <Form.Check
                  type="checkbox"
                  id="unsaved-instances-select-all"
                  label="Select all"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={isSaving}
                />
                <Button
                  type="button"
                  variant="outline-dark"
                  size="sm"
                  className="unsaved-instances-panel-save-all-btn"
                  onClick={handleSaveAll}
                  disabled={isSaving}
                >
                  Save all ({drafts.length})
                </Button>
              </div>
            )}

            <div
              id="unsaved-instances-panel-list"
              className="unsaved-instances-panel-list"
            >
              {drafts.length === 0 ? (
                <div className="unsaved-instances-panel-empty" role="status">
                  No unsaved instances. Edit an instance and your draft will
                  appear here while you work across multiple instances.
                </div>
              ) : (
                drafts.map((draft) => {
                  const typeColor = typeColors[draft.type] || "#6c757d";
                  const isCurrent = draft.instanceId === currentInstanceId;
                  const isSelected = selectedIds.includes(draft.instanceId);

                  return (
                    <div
                      key={draft.instanceId}
                      className={`unsaved-instances-panel-item${
                        isCurrent ? " unsaved-instances-panel-item--current" : ""
                      }`}
                    >
                      <Form.Check
                        type="checkbox"
                        id={`unsaved-select-${draft.instanceId}`}
                        checked={isSelected}
                        onChange={() => toggleSelected(draft.instanceId)}
                        disabled={isSaving}
                        aria-label={`Select ${draft.instanceName}`}
                        className="unsaved-instances-panel-item-checkbox"
                      />

                      <button
                        type="button"
                        className="unsaved-instances-panel-item-main"
                        onClick={() => handleOpen(draft.instanceId)}
                        aria-current={isCurrent ? "true" : undefined}
                      >
                        <div className="unsaved-instances-panel-item-type">
                          <FontAwesomeIcon
                            icon={faCircle}
                            className="me-2"
                            style={{ color: typeColor, fontSize: "0.55rem" }}
                            aria-hidden="true"
                          />
                          {draft.type}
                          {draft.isNew ? (
                            <span className="unsaved-instances-panel-item-badge">
                              New
                            </span>
                          ) : (
                            <span className="unsaved-instances-panel-item-badge">
                              Draft
                            </span>
                          )}
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
                          size="sm"
                          className="unsaved-instances-panel-save-btn"
                          onClick={(event) =>
                            handleSaveOne(event, draft.instanceId)
                          }
                          disabled={isSaving}
                          aria-label={`Save ${draft.instanceName}`}
                          title="Save instance"
                        >
                          <FontAwesomeIcon icon={faFloppyDisk} />
                        </Button>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="unsaved-instances-panel-discard-btn"
                          onClick={() => handleDiscard(draft.instanceId)}
                          disabled={isSaving}
                          aria-label={`Discard unsaved changes for ${draft.instanceName}`}
                          title="Discard changes"
                        >
                          <FontAwesomeIcon icon={faXmark} />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {drafts.length > 0 && (
              <div className="unsaved-instances-panel-footer">
                <Button
                  type="button"
                  variant="dark"
                  size="sm"
                  className="w-100"
                  onClick={handleSaveSelected}
                  disabled={isSaving || selectedCount === 0}
                >
                  {isSaving
                    ? "Saving..."
                    : `Save selected (${selectedCount})`}
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
    </aside>
  );
}
