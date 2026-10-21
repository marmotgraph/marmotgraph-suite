import React, { useMemo, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle } from "@fortawesome/free-solid-svg-icons";
import {
  SavePlan,
  SavePlanItem,
  SaveValidationIssue,
} from "../modules/editor/instanceSave";
import "./SavePlanModal.css";

const typeColors: Record<string, string> = {
  Appliance: "#ff9800",
  "Asset Tag": "#9c27b0",
  Blade: "#2196f3",
  Building: "#4caf50",
  Cabinet: "#f44336",
  Canton: "#00bcd4",
};

type SavePlanModalProps = {
  show: boolean;
  plan: SavePlan | null;
  isSaving?: boolean;
  saveError?: string | null;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
  onOpenInstance: (instanceId: string) => void;
};

function getIssueForItem(
  item: SavePlanItem,
  validationIssues: SaveValidationIssue[],
): SaveValidationIssue | undefined {
  return validationIssues.find((issue) => issue.instanceId === item.instanceId);
}

export default function SavePlanModal({
  show,
  plan,
  isSaving = false,
  saveError = null,
  onConfirm,
  onCancel,
  onOpenInstance,
}: SavePlanModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (show && plan) {
      setSelectedIds(plan.items.map((item) => item.instanceId));
    }
  }, [plan, show]);

  const selectedCount = selectedIds.length;
  const hasValidationIssues = (plan?.validationIssues.length ?? 0) > 0;
  const invalidSelectedCount = useMemo(() => {
    if (!plan) {
      return 0;
    }

    const invalidIds = new Set(
      plan.validationIssues.map((issue) => issue.instanceId),
    );

    return selectedIds.filter((instanceId) => invalidIds.has(instanceId)).length;
  }, [plan, selectedIds]);

  const toggleItem = (instanceId: string) => {
    setSelectedIds((previous) =>
      previous.includes(instanceId)
        ? previous.filter((id) => id !== instanceId)
        : [...previous, instanceId],
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedIds);
  };

  if (!plan) {
    return null;
  }

  const primaryRootName =
    plan.items.find((item) => plan.rootIds.includes(item.instanceId))
      ?.instanceName ?? "selected instances";

  return (
    <Modal
      show={show}
      onHide={onCancel}
      centered
      size="lg"
      className="save-plan-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Save {plan.rootIds.length === 1 ? primaryRootName : "instances"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {plan.items.length > 1 && (
          <p className="save-plan-modal-intro text-muted">
            Some instances link to other unsaved instances. Saving them together
            keeps links valid.
          </p>
        )}

        {hasValidationIssues && (
          <Alert variant="warning" className="save-plan-modal-alert">
            Fix required fields before saving. Open an instance to edit it, then
            try again.
          </Alert>
        )}

        {saveError && (
          <Alert variant="danger" className="save-plan-modal-alert">
            {saveError}
          </Alert>
        )}

        <div className="save-plan-modal-list">
          {plan.items.map((item) => {
            const issue = getIssueForItem(item, plan.validationIssues);
            const typeColor = typeColors[item.type] || "#6c757d";
            const isChecked = selectedIds.includes(item.instanceId);

            return (
              <div
                key={item.instanceId}
                className={`save-plan-modal-item${
                  issue ? " save-plan-modal-item--invalid" : ""
                }`}
              >
                <Form.Check
                  type="checkbox"
                  id={`save-plan-item-${item.instanceId}`}
                  checked={isChecked}
                  onChange={() => toggleItem(item.instanceId)}
                  label={
                    <span className="save-plan-modal-item-content">
                      <span className="save-plan-modal-item-header">
                        <FontAwesomeIcon
                          icon={faCircle}
                          className="save-plan-modal-item-type-icon"
                          style={{ color: typeColor }}
                          aria-hidden="true"
                        />
                        <span className="save-plan-modal-item-name">
                          {item.instanceName}
                        </span>
                        {item.isNew ? (
                          <span className="save-plan-modal-item-badge">New</span>
                        ) : (
                          <span className="save-plan-modal-item-badge">
                            Draft
                          </span>
                        )}
                      </span>
                      <span className="save-plan-modal-item-meta">
                        {item.type}
                        {item.requiredBy && (
                          <span> · Required by {item.requiredBy}</span>
                        )}
                        {item.changedFieldLabels &&
                          item.changedFieldLabels.length > 0 && (
                            <span>
                              {" "}
                              · Changed: {item.changedFieldLabels.join(", ")}
                            </span>
                          )}
                      </span>
                      {issue && (
                        <span className="save-plan-modal-item-error">
                          Missing required: {issue.missingFields.join(", ")}
                        </span>
                      )}
                    </span>
                  }
                />
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="save-plan-modal-open-btn"
                  onClick={() => onOpenInstance(item.instanceId)}
                >
                  Open
                </Button>
              </div>
            );
          })}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <span className="save-plan-modal-footer-summary text-muted">
          {selectedCount} selected
          {invalidSelectedCount > 0
            ? ` · ${invalidSelectedCount} need attention`
            : ""}
        </span>
        <Button variant="outline-secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="dark"
          onClick={handleConfirm}
          disabled={
            isSaving || selectedCount === 0 || invalidSelectedCount > 0
          }
        >
          {isSaving
            ? "Saving..."
            : `Save ${selectedCount} instance${selectedCount === 1 ? "" : "s"}`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
