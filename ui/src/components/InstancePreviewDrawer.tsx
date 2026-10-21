import React, { useEffect, useMemo, useState } from "react";
import { Button, Offcanvas } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faCopy } from "@fortawesome/free-solid-svg-icons";
import LinkedInstancesField from "./LinkedInstancesField";
import { ReleaseStatusBadge } from "./ReleaseStatusBadge";
import {
  getInstanceFieldLabel,
  getInstanceFieldValues,
  Instance,
  InstanceLinkedFieldKey,
} from "../modules/editor/editorMockData";
import "./InstancePreviewDrawer.css";

type InstancePreviewDrawerProps = {
  instance: Instance | null;
  show: boolean;
  onHide: () => void;
  onNavigate: (path: string) => void;
  onPreviewInstance: (instanceId: string) => void;
  typeColors: Record<string, string>;
};

const linkedFieldKeys: InstanceLinkedFieldKey[] = ["field3", "field4", "field5"];

export function InstancePreviewDrawer({
  instance,
  show,
  onHide,
  onNavigate,
  onPreviewInstance,
  typeColors,
}: InstancePreviewDrawerProps) {
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    setCopiedId(false);
  }, [instance?.instanceId]);

  const fieldValues = useMemo(
    () => (instance ? getInstanceFieldValues(instance.instanceId) : null),
    [instance],
  );

  const outgoingCount = instance?.directLinks?.length ?? 0;
  const incomingCount = instance?.reverseLinks?.length ?? 0;

  const canEdit = instance?.permissions.includes("Edit") ?? false;
  const canRelease =
    (instance?.permissions.includes("Release") ?? false) &&
    instance?.releaseStatus !== "released";

  const handleNavigate = (path: string) => {
    onHide();
    onNavigate(path);
  };

  const handleCopyId = async () => {
    if (!instance) {
      return;
    }

    await navigator.clipboard.writeText(instance.instanceId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      placement="end"
      scroll
      backdrop
      className="instance-preview-drawer"
      aria-labelledby="instance-preview-drawer-title"
    >
      {instance && fieldValues && (
        <>
          <Offcanvas.Header closeButton className="instance-preview-drawer-header">
            <div>
              <Offcanvas.Title
                id="instance-preview-drawer-title"
                className="instance-preview-drawer-title"
              >
                {instance.instanceName}
              </Offcanvas.Title>
              <div className="instance-preview-drawer-meta">
                <FontAwesomeIcon
                  icon={faCircle}
                  className="type-color-icon me-1"
                  style={{ color: typeColors[instance.type] || "#999" }}
                />
                <span>{instance.type}</span>
                <span className="instance-preview-drawer-meta-separator">·</span>
                <ReleaseStatusBadge status={instance.releaseStatus} />
              </div>
            </div>
          </Offcanvas.Header>

          <Offcanvas.Body className="instance-preview-drawer-body">
            <div className="instance-preview-drawer-section">
              <div className="instance-preview-drawer-label">Instance ID</div>
              <div className="instance-preview-drawer-id-row">
                <code className="instance-preview-drawer-id">
                  {instance.instanceId}
                </code>
                <Button
                  variant="link"
                  size="sm"
                  className="instance-preview-drawer-copy-btn p-0"
                  onClick={handleCopyId}
                  title={copiedId ? "ID copied!" : "Copy ID"}
                  aria-label={copiedId ? "ID copied" : "Copy instance ID"}
                >
                  <FontAwesomeIcon icon={faCopy} />
                </Button>
              </div>
            </div>

            <div className="instance-preview-drawer-section">
              <div className="instance-preview-drawer-label">Space</div>
              <div className="instance-preview-drawer-value">{instance.space}</div>
            </div>

            {instance.lastVisited && (
              <div className="instance-preview-drawer-section">
                <div className="instance-preview-drawer-label">Last visited</div>
                <div className="instance-preview-drawer-value">
                  {instance.lastVisited}
                </div>
              </div>
            )}

            <div className="instance-preview-drawer-section">
              <div className="instance-preview-drawer-label">Links</div>
              <div className="instance-preview-drawer-value">
                {outgoingCount} outgoing · {incomingCount} incoming
              </div>
            </div>

            <div className="instance-preview-drawer-fields">
              <div className="instance-preview-drawer-section">
                <div className="instance-preview-drawer-label">
                  {getInstanceFieldLabel("field1")}
                </div>
                <div className="instance-preview-drawer-value">
                  {fieldValues.field1 || "—"}
                </div>
              </div>

              <div className="instance-preview-drawer-section">
                <div className="instance-preview-drawer-label">
                  {getInstanceFieldLabel("field2")}
                </div>
                <div className="instance-preview-drawer-value">
                  {fieldValues.field2 || "—"}
                </div>
              </div>

              {linkedFieldKeys.map((fieldKey) => (
                <div key={fieldKey} className="instance-preview-drawer-section">
                  <div className="instance-preview-drawer-label">
                    {getInstanceFieldLabel(fieldKey)}
                  </div>
                  <div className="instance-preview-drawer-linked-field">
                    <LinkedInstancesField
                      fieldKey={fieldKey}
                      fieldLabel={getInstanceFieldLabel(fieldKey)}
                      linkedInstances={fieldValues[fieldKey]}
                      onInstanceClick={onPreviewInstance}
                      variant="view"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Offcanvas.Body>

          <div className="instance-preview-drawer-footer">
            <Button
              variant="dark"
              size="sm"
              onClick={() =>
                handleNavigate(`/instances/${instance.instanceId}`)
              }
            >
              Open full page
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={!canEdit}
              title={canEdit ? "Edit" : "Edit permission required"}
              onClick={() =>
                handleNavigate(`/instances/${instance.instanceId}?edit=true`)
              }
            >
              Edit
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={!canRelease}
              title={
                instance.releaseStatus === "released"
                  ? "Already released"
                  : canRelease
                    ? "Release"
                    : "Release permission required"
              }
              onClick={() =>
                handleNavigate(`/instances/${instance.instanceId}?release=true`)
              }
            >
              Release
            </Button>
          </div>
        </>
      )}
    </Offcanvas>
  );
}
