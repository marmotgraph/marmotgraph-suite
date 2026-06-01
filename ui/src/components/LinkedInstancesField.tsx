import React, { useMemo, useState } from "react";
import { Badge, Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle } from "@fortawesome/free-solid-svg-icons";
import { useUnsavedInstances } from "../contexts/UnsavedInstancesContext";
import {
  enrichLinkedInstancesWithDrafts,
  InstanceLinkedFieldKey,
  LinkedInstance,
} from "../modules/editor/editorMockData";
import LinkedInstanceDraftBadge from "./LinkedInstanceDraftBadge";
import LinkedInstancesEditModal from "./LinkedInstancesEditModal";
import LinkedInstancesModal from "./LinkedInstancesModal";
import "./LinkedInstancesField.css";

const typeColors: Record<string, string> = {
  Appliance: "#ff9800",
  "Asset Tag": "#9c27b0",
  Blade: "#2196f3",
  Building: "#4caf50",
  Cabinet: "#f44336",
  Canton: "#00bcd4",
};

const PREVIEW_LIMIT = 10;

type LinkedInstancesFieldProps = {
  fieldKey: InstanceLinkedFieldKey;
  fieldLabel: string;
  linkedInstances: LinkedInstance[];
  onInstanceClick: (instanceId: string) => void;
  isEditMode?: boolean;
  onChange?: (linkedInstances: LinkedInstance[]) => void;
  currentInstanceId?: string;
  parentSpace?: string;
  variant?: "view" | "edit";
};

export default function LinkedInstancesField({
  fieldKey,
  fieldLabel,
  linkedInstances,
  onInstanceClick,
  isEditMode = false,
  onChange,
  currentInstanceId,
  parentSpace,
  variant = "view",
}: LinkedInstancesFieldProps) {
  const { getDraft } = useUnsavedInstances();
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const displayInstances = useMemo(
    () => enrichLinkedInstancesWithDrafts(linkedInstances, getDraft),
    [getDraft, linkedInstances],
  );
  const previewInstances = displayInstances.slice(0, PREVIEW_LIMIT);
  const hiddenCount = Math.max(displayInstances.length - PREVIEW_LIMIT, 0);
  const badgeClassName =
    variant === "edit" ? "tag-badge me-2 mb-2" : "view-badge me-2 mb-2";

  return (
    <>
      <div
        className={
          variant === "edit"
            ? "tag-container linked-instances-field"
            : "linked-instances-field"
        }
      >
        {displayInstances.length === 0 ? (
          <span className="linked-instances-field-empty text-muted">
            No linked instances
          </span>
        ) : (
          previewInstances.map((instance) => {
            const typeColor = typeColors[instance.type] || "#6c757d";

            return (
              <Badge
                key={instance.instanceId}
                bg="light"
                text="dark"
                className={`${badgeClassName} linked-instance-badge`}
                onClick={() => onInstanceClick(instance.instanceId)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onInstanceClick(instance.instanceId);
                  }
                }}
              >
                <FontAwesomeIcon
                  icon={faCircle}
                  className="linked-instance-badge-icon"
                  style={{ color: typeColor }}
                />
                <span className="linked-instance-badge-name">
                  {instance.instanceName}
                </span>
                <LinkedInstanceDraftBadge
                  instance={instance}
                  className="linked-instance-draft-badge--inline"
                />
              </Badge>
            );
          })
        )}

        {isEditMode && onChange ? (
          <Button
            variant="link"
            size="sm"
            className="linked-instances-see-all-btn p-0 mb-2"
            onClick={() => setShowEditModal(true)}
          >
            Manage ({displayInstances.length})
          </Button>
        ) : (
          hiddenCount > 0 && (
            <Button
              variant="link"
              size="sm"
              className="linked-instances-see-all-btn p-0 mb-2"
              onClick={() => setShowViewModal(true)}
            >
              See all ({displayInstances.length})
            </Button>
          )
        )}
      </div>

      {isEditMode && onChange ? (
        <LinkedInstancesEditModal
          show={showEditModal}
          onHide={() => setShowEditModal(false)}
          fieldKey={fieldKey}
          linkedInstances={linkedInstances}
          currentInstanceId={currentInstanceId}
          parentSpace={parentSpace}
          onApply={onChange}
        />
      ) : (
        <LinkedInstancesModal
          show={showViewModal}
          onHide={() => setShowViewModal(false)}
          fieldLabel={fieldLabel}
          linkedInstances={displayInstances}
          onInstanceClick={onInstanceClick}
        />
      )}
    </>
  );
}
