import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircle,
  faLinkSlash,
  faLock,
} from "@fortawesome/free-solid-svg-icons";
import { useUnsavedInstances } from "../contexts/UnsavedInstancesContext";
import {
  enrichLinkedInstancesWithDrafts,
  isResolvedLink,
  LinkedInstance,
  linkedInstanceDisplayName,
  linkedInstanceStatusDescription,
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
const NO_TYPES: string[] = [];

type LinkedInstancesFieldProps = {
  fieldLabel: string;
  /** The types (identifiers) of the instances which can be linked - all if empty */
  allowedTypes?: string[];
  linkedInstances: LinkedInstance[];
  onInstanceClick: (instanceId: string) => void;
  isEditMode?: boolean;
  onChange?: (linkedInstances: LinkedInstance[]) => void;
  currentInstanceId?: string;
  parentSpace?: string;
  variant?: "view" | "edit";
  /** The id of the linked instance to highlight */
  highlightedInstanceId?: string;
  /** Called with the id of the linked instance hovered (undefined when left) */
  onInstanceHover?: (instanceId: string | undefined) => void;
};

export default function LinkedInstancesField({
  fieldLabel,
  allowedTypes = NO_TYPES,
  linkedInstances,
  onInstanceClick,
  isEditMode = false,
  onChange,
  currentInstanceId,
  parentSpace,
  variant = "view",
  highlightedInstanceId,
  onInstanceHover,
}: LinkedInstancesFieldProps) {
  const { getDraft } = useUnsavedInstances();
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const displayInstances = useMemo(
    () => enrichLinkedInstancesWithDrafts(linkedInstances, getDraft),
    [getDraft, linkedInstances],
  );
  const highlightedRef = useRef<HTMLElement>(null);
  const previewInstances = displayInstances.slice(0, PREVIEW_LIMIT);
  if (
    highlightedInstanceId &&
    !previewInstances.some((instance) => instance.instanceId === highlightedInstanceId)
  ) {
    const highlighted = displayInstances.find(
      (instance) => instance.instanceId === highlightedInstanceId,
    );
    if (highlighted) {
      previewInstances.push(highlighted);
    }
  }
  const hiddenCount = Math.max(displayInstances.length - previewInstances.length, 0);

  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [highlightedInstanceId]);
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
            const typeColor =
              instance.typeColor || typeColors[instance.type] || "#6c757d";
            const hoverProps = {
              onMouseEnter:
                onInstanceHover &&
                (() => onInstanceHover(instance.instanceId)),
              onMouseLeave: onInstanceHover && (() => onInstanceHover(undefined)),
            };
            const highlightClassName =
              highlightedInstanceId === instance.instanceId
                ? " linked-instance-badge--highlighted"
                : "";

            const highlighted = highlightedInstanceId === instance.instanceId;
            if (!isResolvedLink(instance)) {
              const restricted = instance.linkStatus === "restricted";
              return (
                <Badge
                  key={instance.instanceId}
                  ref={highlighted ? highlightedRef : undefined}
                  bg="light"
                  text="dark"
                  className={`${badgeClassName} linked-instance-badge linked-instance-badge--${instance.linkStatus}${highlightClassName}`}
                  {...hoverProps}
                  title={linkedInstanceStatusDescription(instance)}
                >
                  <FontAwesomeIcon
                    icon={restricted ? faLock : faLinkSlash}
                    className="linked-instance-badge-status-icon"
                    style={restricted ? { color: typeColor } : undefined}
                  />
                  <span className="linked-instance-badge-name">
                    {linkedInstanceDisplayName(instance)}
                    {restricted && instance.type ? ` (${instance.type})` : ""}
                  </span>
                </Badge>
              );
            }

            return (
              <Badge
                key={instance.instanceId}
                ref={highlighted ? highlightedRef : undefined}
                bg="light"
                text="dark"
                className={`${badgeClassName} linked-instance-badge${highlightClassName}`}
                {...hoverProps}
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
            className="linked-instances-see-all-btn p-0"
            onClick={() => setShowEditModal(true)}
          >
            Manage ({displayInstances.length})
          </Button>
        ) : (
          hiddenCount > 0 && (
            <Button
              variant="link"
              size="sm"
              className="linked-instances-see-all-btn p-0"
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
          fieldLabel={fieldLabel}
          allowedTypes={allowedTypes}
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
