import React, { createContext, useContext, useMemo, useState } from "react";
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

/**
 * Whether the links are shown by the identifier they are linked with only - for links whose targets are not looked up
 * (nothing is known about them, including whether they exist).
 */
export const LinkIdentifiersOnlyContext = createContext(false);

/** How many linked instances are shown before the rest is left to the dialog - as many as the links panel starts with */
const PREVIEW_LIMIT = 5;
const NO_TYPES: string[] = [];

type LinkedInstancesFieldProps = {
  fieldLabel: string;
  /** The types (identifiers) of the instances which can be linked - all if empty */
  allowedTypes?: string[];
  /** If at most one instance can be linked */
  single?: boolean;
  linkedInstances: LinkedInstance[];
  onInstanceClick: (instanceId: string) => void;
  isEditMode?: boolean;
  onChange?: (linkedInstances: LinkedInstance[]) => void;
  currentInstanceId?: string;
  parentSpace?: string;
  variant?: "view" | "edit";
};

export default function LinkedInstancesField({
  fieldLabel,
  allowedTypes = NO_TYPES,
  single = false,
  linkedInstances,
  onInstanceClick,
  isEditMode = false,
  onChange,
  currentInstanceId,
  parentSpace,
  variant = "view",
}: Readonly<LinkedInstancesFieldProps>) {
  const identifiersOnly = useContext(LinkIdentifiersOnlyContext);
  const { getDraft } = useUnsavedInstances();
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const displayInstances = useMemo(
    () => enrichLinkedInstancesWithDrafts(linkedInstances, getDraft),
    [getDraft, linkedInstances],
  );
  // While editing, the tags are plain information - the instances are managed in the dialog
  const navigable = !(isEditMode && onChange);
  // The tags don't react to the pointer beyond being clickable: with only a few of them shown there is little to find,
  // and the links panel doesn't highlight them either
  const previewInstances = displayInstances.slice(0, PREVIEW_LIMIT);
  const hiddenCount = Math.max(displayInstances.length - previewInstances.length, 0);
  const singleAction = displayInstances.length > 0 ? "Change" : "Select";
  const badgeClassName =
    variant === "edit" ? "tag-badge me-2 mb-2" : "view-badge me-2 mb-2";

  if (identifiersOnly) {
    return (
      <div className="linked-instance-identifiers">
        {linkedInstances.map((instance) => (
          <div key={instance.instanceId}>{instance.instanceId}</div>
        ))}
      </div>
    );
  }

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
            if (!isResolvedLink(instance)) {
              const restricted = instance.linkStatus === "restricted";
              return (
                <Badge
                  key={instance.instanceId}
                  bg="light"
                  text="dark"
                  className={`${badgeClassName} linked-instance-badge linked-instance-badge--${instance.linkStatus}`}
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
                bg="light"
                text="dark"
                className={`${badgeClassName} linked-instance-badge${
                  navigable ? "" : " linked-instance-badge--static"
                }`}
                {...(navigable
                  ? {
                      onClick: () => onInstanceClick(instance.instanceId),
                      role: "button",
                      tabIndex: 0,
                      onKeyDown: (event: React.KeyboardEvent) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onInstanceClick(instance.instanceId);
                        }
                      },
                    }
                  : {})}
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

        {/* Tells the list is cut off - plain information, the link beside it opens the instances */}
        {isEditMode && onChange && !single && hiddenCount > 0 && (
          <Badge
            bg="light"
            text="dark"
            className={`${badgeClassName} linked-instances-more-badge`}
            title={`Showing ${previewInstances.length} of ${displayInstances.length}`}
          >
            +{hiddenCount} more
          </Badge>
        )}

        {isEditMode && onChange ? (
          <Button
            variant="link"
            size="sm"
            className="linked-instances-see-all-btn p-0"
            onClick={() => setShowEditModal(true)}
            aria-label={single ? `${singleAction} ${fieldLabel}` : undefined}
          >
            {single
              ? singleAction
              : hiddenCount > 0
                ? `Manage all ${displayInstances.length}`
                : `Manage (${displayInstances.length})`}
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
          single={single}
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
