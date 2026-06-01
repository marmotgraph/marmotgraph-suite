import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faCircle,
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
};

export default function UnsavedInstancesPanel({
  currentInstanceId,
  onDiscardCurrent,
}: UnsavedInstancesPanelProps) {
  const navigate = useNavigate();
  const { drafts, removeDraft } = useUnsavedInstances();
  const [isExpanded, setIsExpanded] = useState(true);

  const handleOpen = (instanceId: string) => {
    navigate(`/editor/instance/${instanceId}`);
  };

  const handleDiscard = (instanceId: string) => {
    removeDraft(instanceId);

    if (instanceId === currentInstanceId) {
      onDiscardCurrent?.();
    }
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
              drafts.map((draft) => {
                const typeColor = typeColors[draft.type] || "#6c757d";
                const isCurrent = draft.instanceId === currentInstanceId;

                return (
                  <div
                    key={draft.instanceId}
                    className={`unsaved-instances-panel-item${
                      isCurrent ? " unsaved-instances-panel-item--current" : ""
                    }`}
                  >
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

                    <Button
                      variant="link"
                      size="sm"
                      className="unsaved-instances-panel-discard-btn"
                      onClick={() => handleDiscard(draft.instanceId)}
                      aria-label={`Discard unsaved changes for ${draft.instanceName}`}
                      title="Discard changes"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
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
