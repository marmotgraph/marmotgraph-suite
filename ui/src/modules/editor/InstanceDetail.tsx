import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Breadcrumb, Button, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faCopy, faPencil } from "@fortawesome/free-solid-svg-icons";
import {
  areInstanceFieldValuesEqual,
  emptyInstanceFieldValues,
  getChangedInstanceFieldKeys,
  getChangedInstanceFieldLabels,
  getInstanceFieldValues,
  Instance,
  InstanceFieldValues
} from "./editorMockData";
import { useInstances } from "../../contexts/InstancesContext";
import { useUnsavedInstances } from "../../contexts/UnsavedInstancesContext";
import InstanceLinksPanel from "../../components/InstanceLinksPanel";
import LinkedInstancesField from "../../components/LinkedInstancesField";
import UnsavedInstancesPanel from "../../components/UnsavedInstancesPanel";
import DirLinkIcon from "../../assets/icons/DirLink.svg";
import RevLinkIcon from "../../assets/icons/RevLink.svg";
import RevDirLinkIcon from "../../assets/icons/RevDirLink.svg";
import NoLinksIcon from "../../assets/icons/NoLinks.svg";
import "./InstanceDetail.css";

const typeColors: Record<string, string> = {
  Appliance: "#ff9800",
  "Asset Tag": "#9c27b0",
  Blade: "#2196f3",
  Building: "#4caf50",
  Cabinet: "#f44336",
  Canton: "#00bcd4",
};

export default function InstanceDetail() {
  const { instanceId } = useParams<{ instanceId: string }>();

  if (!instanceId) {
    return (
      <div>
        <h2>Instance not found</h2>
        <p>No instance ID provided.</p>
      </div>
    );
  }

  return <InstanceDetailView key={instanceId} instanceId={instanceId} />;
}

function InstanceDetailView({ instanceId }: { instanceId: string }) {
  const navigate = useNavigate();
  const { getInstance, addInstance, instances } = useInstances();
  const { getDraft, upsertDraft, removeDraft } = useUnsavedInstances();
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search),
  );
  const baselineRef = useRef<InstanceFieldValues>(emptyInstanceFieldValues);

  const [breadcrumbTrail, setBreadcrumbTrail] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const isNewInstance = instanceId?.startsWith("new-");
  const newInstanceName = searchParams.get("name") || "";
  const newInstanceType = searchParams.get("type") || "";

  const [isEditMode, setIsEditMode] = useState(isNewInstance);
  const [field1, setField1] = useState("");
  const [field2, setField2] = useState("");
  const [field3Values, setField3Values] = useState<
    InstanceFieldValues["field3"]
  >([]);
  const [field4Values, setField4Values] = useState<
    InstanceFieldValues["field4"]
  >([]);
  const [field5Values, setField5Values] = useState<
    InstanceFieldValues["field5"]
  >([]);

  const instance = isNewInstance
    ? {
        id: instances.length + 1,
        instanceId: instanceId || "",
        type: newInstanceType,
        instanceName: newInstanceName,
        space: "",
        permissions: "",
        bookmarked: false,
        releaseStatus: "in progress" as const,
        directLinks: [],
        reverseLinks: [],
      }
    : getInstance(instanceId || "");

  const typeColor = instance
    ? typeColors[instance.type] || "#6c757d"
    : "#6c757d";

  const getSavedFieldValues = useCallback((): InstanceFieldValues => {
    if (isNewInstance) {
      return emptyInstanceFieldValues;
    }

    return getInstanceFieldValues(instanceId || "");
  }, [instanceId, isNewInstance]);

  const applyFieldValues = useCallback((values: InstanceFieldValues) => {
    setField1(values.field1);
    setField2(values.field2);
    setField3Values(values.field3);
    setField4Values(values.field4);
    setField5Values(values.field5);
  }, []);

  const resetToSaved = useCallback(() => {
    applyFieldValues(getSavedFieldValues());
    setIsEditMode(false);
  }, [applyFieldValues, getSavedFieldValues]);

  useEffect(() => {
    if (instance && instanceId) {
      setBreadcrumbTrail((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === instanceId);

        if (existingIndex !== -1) {
          return prev.slice(0, existingIndex + 1);
        }

        return [...prev, { id: instanceId, name: instance.instanceName }].slice(
          -5,
        );
      });
    }
  }, [instanceId, instance]);

  useEffect(() => {
    if (!instanceId) {
      return;
    }

    const savedValues = getSavedFieldValues();
    const draft = getDraft(instanceId);

    if (draft) {
      applyFieldValues(draft.fieldValues);
      baselineRef.current = savedValues;
      setIsEditMode(true);
      return;
    }

    applyFieldValues(savedValues);
    baselineRef.current = savedValues;
    setIsEditMode(Boolean(isNewInstance));
    // Only re-initialize when navigating between instances — not when unrelated
    // drafts are added (getDraft identity changes would exit edit mode otherwise).
  }, [applyFieldValues, getSavedFieldValues, instanceId, isNewInstance]);

  const currentFieldValues = useMemo<InstanceFieldValues>(
    () => ({
      field1,
      field2,
      field3: field3Values,
      field4: field4Values,
      field5: field5Values,
    }),
    [field1, field2, field3Values, field4Values, field5Values],
  );

  const changedFieldKeys = useMemo(() => {
    if (!isEditMode) {
      return new Set<keyof InstanceFieldValues>();
    }

    return new Set(
      getChangedInstanceFieldKeys(currentFieldValues, baselineRef.current),
    );
  }, [currentFieldValues, isEditMode]);

  const changedFieldLabels = useMemo(
    () =>
      getChangedInstanceFieldLabels(currentFieldValues, baselineRef.current),
    [currentFieldValues],
  );

  const hasUnsavedChanges = isEditMode && changedFieldKeys.size > 0;

  useEffect(() => {
    if (!instanceId || !instance || !isEditMode) {
      return;
    }

    if (!areInstanceFieldValuesEqual(currentFieldValues, baselineRef.current)) {
      upsertDraft({
        instanceId,
        instanceName: instance.instanceName,
        type: instance.type,
        fieldValues: currentFieldValues,
        updatedAt: Date.now(),
        isNew: isNewInstance,
        changedFieldLabels,
      });
      return;
    }

    removeDraft(instanceId);
  }, [
    changedFieldLabels,
    currentFieldValues,
    instance,
    instanceId,
    isEditMode,
    isNewInstance,
    removeDraft,
    upsertDraft,
  ]);

  if (!instance) {
    return (
      <div>
        <h2>Instance not found</h2>
        <p>No instance found with ID: {instanceId}</p>
      </div>
    );
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(instanceId || "");
  };

  const handleEdit = () => {
    baselineRef.current = getSavedFieldValues();
    setIsEditMode(true);
  };

  const handleSave = () => {
    if (isNewInstance) {
      const newId = `inst-${crypto.randomUUID()}`;

      const newInstance: Instance = {
        id: instances.length + 1,
        instanceId: newId,
        type: instance.type,
        instanceName: instance.instanceName,
        space: instance.space || "default-space",
        permissions: "View, Edit",
        bookmarked: false,
        releaseStatus: "in progress",
        directLinks: [],
        reverseLinks: [],
      };

      removeDraft(instanceId || "");
      addInstance(newInstance);
      navigate(`/editor/instance/${newId}`);
      return;
    }

    removeDraft(instanceId || "");
    baselineRef.current = currentFieldValues;
    setIsEditMode(false);
  };

  const handleCancel = () => {
    removeDraft(instanceId || "");
    resetToSaved();

    if (isNewInstance) {
      navigate("/editor");
    }
  };

  const handleLinkClick = (linkedInstanceId: string) => {
    navigate(`/editor/instance/${linkedInstanceId}`);
  };

  const getLinkStatusIcon = () => {
    const hasDirectLinks =
      instance?.directLinks && instance.directLinks.length > 0;
    const hasReverseLinks =
      instance?.reverseLinks && instance.reverseLinks.length > 0;

    if (hasDirectLinks && hasReverseLinks) {
      return RevDirLinkIcon;
    } else if (hasDirectLinks) {
      return DirLinkIcon;
    } else if (hasReverseLinks) {
      return RevLinkIcon;
    } else {
      return NoLinksIcon;
    }
  };

  return (
    <>
      <div className="instance-detail-layout">
        <aside className="instance-detail-side instance-detail-side--reverse">
          <InstanceLinksPanel
            links={instance?.reverseLinks || []}
            onLinkClick={handleLinkClick}
            title="Incoming Links"
            isReverse={true}
          />
        </aside>

        <div className="instance-detail-main">
          <Breadcrumb className="instance-detail-breadcrumb mb-3">
            <Breadcrumb.Item
              onClick={() => navigate("/editor")}
              style={{ cursor: "pointer" }}
            >
              Editor
            </Breadcrumb.Item>
            {breadcrumbTrail.map((item, index) => {
              const isLast = index === breadcrumbTrail.length - 1;
              return (
                <Breadcrumb.Item
                  key={item.id}
                  active={isLast}
                  onClick={
                    isLast
                      ? undefined
                      : () => navigate(`/editor/instance/${item.id}`)
                  }
                  style={isLast ? {} : { cursor: "pointer" }}
                >
                  {item.name}
                </Breadcrumb.Item>
              );
            })}
          </Breadcrumb>

          <div
            className="instance-focus-panel"
            style={
              { "--instance-type-color": typeColor } as React.CSSProperties
            }
          >
            <div className="instance-header">
              <div className="d-flex align-items-start justify-content-between">
                <div className="flex-grow-1">
                  <div className="instance-type-label">
                    <FontAwesomeIcon
                      icon={faCircle}
                      className="instance-type-color-icon me-2"
                      style={{ color: typeColor }}
                    />
                    {instance.type}
                  </div>
                  <h2 className="instance-name">{instance.instanceName}</h2>
                  {hasUnsavedChanges && (
                    <div className="instance-unsaved-summary" role="status">
                      Unsaved changes
                      {changedFieldLabels.length > 0 && (
                        <span className="instance-unsaved-summary-fields">
                          {" "}
                          · {changedFieldLabels.join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="instance-meta">
                    <div className="mb-1">
                      <strong>ID:</strong> {instanceId}
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 ms-2"
                        onClick={handleCopyId}
                      >
                        <FontAwesomeIcon icon={faCopy} />
                      </Button>
                    </div>
                    <div>
                      <strong>Space:</strong> {instance.space}
                    </div>
                  </div>
                </div>
                <div className="d-flex flex-column align-items-end gap-2">
                  {!isEditMode && (
                    <Button
                      variant="link"
                      className="edit-icon-btn"
                      onClick={handleEdit}
                      aria-label="Edit"
                      title="Edit"
                    >
                      <FontAwesomeIcon icon={faPencil} />
                    </Button>
                  )}
                  <img
                    src={getLinkStatusIcon()}
                    alt="Link status"
                    className="link-status-icon"
                  />
                </div>
              </div>
            </div>

            {!isEditMode ? (
              <div className="instance-view">
                <div className="mb-4">
                  <div className="view-label">Field 1</div>
                  <div className="view-value">{field1}</div>
                </div>

                <div className="mb-4">
                  <div className="view-label">Field 2</div>
                  <div className="view-value">{field2}</div>
                </div>

                <div className="mb-4">
                  <div className="view-label">Field 3</div>
                  <div className="view-value">
                    <LinkedInstancesField
                      fieldKey="field3"
                      fieldLabel="Field 3"
                      linkedInstances={field3Values}
                      onInstanceClick={handleLinkClick}
                      variant="view"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="view-label">Field 4</div>
                  <div className="view-value">
                    <LinkedInstancesField
                      fieldKey="field4"
                      fieldLabel="Field 4"
                      linkedInstances={field4Values}
                      onInstanceClick={handleLinkClick}
                      variant="view"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="view-label">Field 5</div>
                  <div className="view-value">
                    <LinkedInstancesField
                      fieldKey="field5"
                      fieldLabel="Field 5"
                      linkedInstances={field5Values}
                      onInstanceClick={handleLinkClick}
                      variant="view"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="instance-form">
                <Form.Group className="mb-4">
                  <InstanceFieldLabel
                    isChanged={changedFieldKeys.has("field1")}
                  >
                    Field 1
                  </InstanceFieldLabel>
                  <Form.Control
                    type="text"
                    value={field1}
                    onChange={(e) => setField1(e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <InstanceFieldLabel
                    isChanged={changedFieldKeys.has("field2")}
                  >
                    Field 2
                  </InstanceFieldLabel>
                  <Form.Control
                    type="text"
                    value={field2}
                    onChange={(e) => setField2(e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <InstanceFieldLabel
                    isChanged={changedFieldKeys.has("field3")}
                  >
                    Field 3
                  </InstanceFieldLabel>
                  <LinkedInstancesField
                    fieldKey="field3"
                    fieldLabel="Field 3"
                    linkedInstances={field3Values}
                    onInstanceClick={handleLinkClick}
                    isEditMode
                    onChange={setField3Values}
                    currentInstanceId={instanceId}
                    parentSpace={instance.space}
                    variant="edit"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <InstanceFieldLabel
                    isChanged={changedFieldKeys.has("field4")}
                  >
                    Field 4
                  </InstanceFieldLabel>
                  <LinkedInstancesField
                    fieldKey="field4"
                    fieldLabel="Field 4"
                    linkedInstances={field4Values}
                    onInstanceClick={handleLinkClick}
                    isEditMode
                    onChange={setField4Values}
                    currentInstanceId={instanceId}
                    parentSpace={instance.space}
                    variant="edit"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <InstanceFieldLabel
                    isChanged={changedFieldKeys.has("field5")}
                  >
                    Field 5
                  </InstanceFieldLabel>
                  <LinkedInstancesField
                    fieldKey="field5"
                    fieldLabel="Field 5"
                    linkedInstances={field5Values}
                    onInstanceClick={handleLinkClick}
                    isEditMode
                    onChange={setField5Values}
                    currentInstanceId={instanceId}
                    parentSpace={instance.space}
                    variant="edit"
                  />
                </Form.Group>

                <div className="d-flex gap-2 mt-4">
                  <Button variant="dark" onClick={handleSave}>
                    Save
                  </Button>
                  <Button variant="outline-secondary" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="instance-detail-side instance-detail-side--direct">
          <InstanceLinksPanel
            links={instance?.directLinks || []}
            onLinkClick={handleLinkClick}
            title="Outgoing Links"
            isReverse={false}
          />
        </aside>
      </div>

      <UnsavedInstancesPanel
        currentInstanceId={instanceId}
        onDiscardCurrent={resetToSaved}
      />
    </>
  );
}

function InstanceFieldLabel({
  children,
  isChanged = false,
}: {
  children: React.ReactNode;
  isChanged?: boolean;
}) {
  return (
    <Form.Label
      className={isChanged ? "instance-field-label--changed" : undefined}
    >
      {children}
      {isChanged && (
        <span className="instance-field-label-changed-badge">Unsaved</span>
      )}
    </Form.Label>
  );
}
