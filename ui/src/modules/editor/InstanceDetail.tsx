import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Breadcrumb, Button, Form, Modal } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faCircle,
  faCopy,
  faPencil,
  faTrash,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import {
  areInstanceFieldValuesEqual,
  emptyInstanceFieldValues,
  getChangedInstanceFieldKeys,
  getChangedInstanceFieldLabels,
  getInstanceFieldValues,
  isMandatoryInstanceField,
  Instance,
  InstanceFieldValues,
} from "./editorMockData";
import { useInstances } from "../../contexts/InstancesContext";
import { useUnsavedInstances } from "../../contexts/UnsavedInstancesContext";
import InstanceLinksPanel from "../../components/InstanceLinksPanel";
import LinkedInstancesField from "../../components/LinkedInstancesField";
import SavePlanModal from "../../components/SavePlanModal";
import UnsavedInstancesPanel from "../../components/UnsavedInstancesPanel";
import { SaveExecutionResult } from "./instanceSave";
import { useInstanceSave } from "./useInstanceSave";
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

const SEARCH_UI_BASE_URL = "https://search.kg.ebrains.eu/";

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
  const { getInstance, instances, deleteInstances } = useInstances();
  const {
    getDraft,
    upsertDraft,
    removeDraft,
    registerLiveDraftProvider,
    unregisterLiveDraftProvider,
  } = useUnsavedInstances();
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search),
  );
  const editFromUrl = searchParams.get("edit") === "true";
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
  const [incomingLinksCollapsed, setIncomingLinksCollapsed] = useState(false);
  const [outgoingLinksCollapsed, setOutgoingLinksCollapsed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const collapsedSideCount =
    Number(incomingLinksCollapsed) + Number(outgoingLinksCollapsed);

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
    setIsEditMode(Boolean(isNewInstance || editFromUrl));
    // Only re-initialize when navigating between instances — not when unrelated
    // drafts are added (getDraft identity changes would exit edit mode otherwise).
  }, [applyFieldValues, editFromUrl, getSavedFieldValues, instanceId, isNewInstance]);

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

  const liveDraftRef = useRef({
    fieldValues: currentFieldValues,
    changedFieldLabels: [] as string[],
  });
  liveDraftRef.current = {
    fieldValues: currentFieldValues,
    changedFieldLabels,
  };

  const handleSaveComplete = useCallback(
    (result: SaveExecutionResult, rootIds: string[]) => {
      const mappedCurrentId = instanceId
        ? result.idMappings[instanceId]
        : undefined;

      if (mappedCurrentId) {
        navigate(`/editor/instance/${mappedCurrentId}`);
        return;
      }

      if (instanceId && rootIds.includes(instanceId)) {
        const savedValues = getInstanceFieldValues(instanceId);
        applyFieldValues(savedValues);
        baselineRef.current = savedValues;
        setIsEditMode(false);
      }
    },
    [applyFieldValues, instanceId, navigate],
  );

  const {
    requestSave,
    pendingSave,
    confirmPendingSave,
    cancelPendingSave,
    isSaving,
    saveError,
  } = useInstanceSave({
    onSaveComplete: handleSaveComplete,
  });

  useEffect(() => {
    if (!instanceId || !instance || !isEditMode) {
      unregisterLiveDraftProvider(instanceId || "");
      return;
    }

    registerLiveDraftProvider(instanceId, () => ({
      instanceId,
      instanceName: instance.instanceName,
      type: instance.type,
      space: instance.space,
      fieldValues: liveDraftRef.current.fieldValues,
      updatedAt: Date.now(),
      isNew: isNewInstance,
      changedFieldLabels: liveDraftRef.current.changedFieldLabels,
    }));

    return () => {
      unregisterLiveDraftProvider(instanceId);
    };
  }, [
    instance,
    instanceId,
    isEditMode,
    isNewInstance,
    registerLiveDraftProvider,
    unregisterLiveDraftProvider,
  ]);

  useEffect(() => {
    if (!instanceId || !instance || !isEditMode) {
      return;
    }

    if (!areInstanceFieldValuesEqual(currentFieldValues, baselineRef.current)) {
      upsertDraft({
        instanceId,
        instanceName: instance.instanceName,
        type: instance.type,
        space: instance.space,
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
    if (!instanceId) {
      return;
    }

    requestSave([instanceId]);
  };

  const handleCancel = () => {
    removeDraft(instanceId || "");
    resetToSaved();

    if (isNewInstance) {
      navigate("/editor");
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleConfirmDelete = () => {
    if (!instanceId) {
      return;
    }

    removeDraft(instanceId);

    if (!isNewInstance) {
      deleteInstances([instanceId]);
    }

    setShowDeleteConfirm(false);
    navigate("/editor");
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
      <div
        className={`instance-detail-layout${
          collapsedSideCount > 0
            ? ` instance-detail-layout--sides-${collapsedSideCount}-collapsed`
            : ""
        }`}
      >
        <aside
          className={`instance-detail-side instance-detail-side--reverse${
            incomingLinksCollapsed ? " instance-detail-side--collapsed" : ""
          }`}
        >
          <InstanceLinksPanel
            links={instance?.reverseLinks || []}
            onLinkClick={handleLinkClick}
            title="Incoming Links"
            isReverse={true}
            isCollapsed={incomingLinksCollapsed}
            onCollapsedChange={setIncomingLinksCollapsed}
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
                  <div className="instance-header-actions">
                    {instance.releaseStatus === "released" && !isNewInstance && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="instance-search-link-btn"
                        href={SEARCH_UI_BASE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open this instance in the Knowledge Graph search UI"
                      >
                        View in search UI
                        <FontAwesomeIcon
                          icon={faArrowUpRightFromSquare}
                          className="ms-2"
                          aria-hidden="true"
                        />
                      </Button>
                    )}
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
                    {isEditMode && (
                      <Button
                        variant="link"
                        className="delete-icon-btn"
                        onClick={handleDeleteClick}
                        aria-label="Delete instance"
                        title="Delete instance"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    )}
                  </div>
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
                  <InstanceViewLabel fieldKey="field1">Field 1</InstanceViewLabel>
                  <div className="view-value">{field1}</div>
                </div>

                <div className="mb-4">
                  <InstanceViewLabel fieldKey="field2">Field 2</InstanceViewLabel>
                  <div className="view-value">{field2}</div>
                </div>

                <div className="mb-4">
                  <InstanceViewLabel fieldKey="field3">Field 3</InstanceViewLabel>
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
                  <InstanceViewLabel fieldKey="field4">Field 4</InstanceViewLabel>
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
                  <InstanceViewLabel fieldKey="field5">Field 5</InstanceViewLabel>
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
                    fieldKey="field1"
                    isChanged={changedFieldKeys.has("field1")}
                  >
                    Field 1
                  </InstanceFieldLabel>
                  <Form.Control
                    type="text"
                    value={field1}
                    onChange={(e) => setField1(e.target.value)}
                    aria-required={isMandatoryInstanceField("field1")}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <InstanceFieldLabel
                    fieldKey="field2"
                    isChanged={changedFieldKeys.has("field2")}
                  >
                    Field 2
                  </InstanceFieldLabel>
                  <Form.Control
                    type="text"
                    value={field2}
                    onChange={(e) => setField2(e.target.value)}
                    aria-required={isMandatoryInstanceField("field2")}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <InstanceFieldLabel
                    fieldKey="field3"
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
                    fieldKey="field4"
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
                    fieldKey="field5"
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
                  <Button variant="dark" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline-secondary" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside
          className={`instance-detail-side instance-detail-side--direct${
            outgoingLinksCollapsed ? " instance-detail-side--collapsed" : ""
          }`}
        >
          <InstanceLinksPanel
            links={instance?.directLinks || []}
            onLinkClick={handleLinkClick}
            title="Outgoing Links"
            isReverse={false}
            isCollapsed={outgoingLinksCollapsed}
            onCollapsedChange={setOutgoingLinksCollapsed}
          />
        </aside>
      </div>

      <UnsavedInstancesPanel
        currentInstanceId={instanceId}
        onDiscardCurrent={resetToSaved}
        onRequestSave={requestSave}
        isSaving={isSaving}
      />

      <SavePlanModal
        show={Boolean(pendingSave)}
        plan={pendingSave?.plan ?? null}
        isSaving={isSaving}
        saveError={saveError}
        onConfirm={confirmPendingSave}
        onCancel={cancelPendingSave}
        onOpenInstance={(targetInstanceId) => {
          cancelPendingSave();
          navigate(`/editor/instance/${targetInstanceId}?edit=true`);
        }}
      />

      <Modal
        show={showDeleteConfirm}
        onHide={handleCancelDelete}
        centered
        aria-labelledby="instance-delete-confirm-title"
      >
        <Modal.Header closeButton>
          <Modal.Title id="instance-delete-confirm-title">
            Delete instance?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="instance-delete-confirm-intro">
            You are about to permanently delete{" "}
            <strong>{instance.instanceName}</strong>.
          </p>
          <div className="instance-delete-confirm-summary">
            <div>
              <span className="text-muted">Type:</span> {instance.type}
            </div>
            <div>
              <span className="text-muted">ID:</span> {instanceId}
            </div>
          </div>
          {instance.releaseStatus === "released" && !isNewInstance && (
            <p className="instance-delete-confirm-warning" role="status">
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                className="me-2"
                aria-hidden="true"
              />
              This instance is released. Deleting it will also remove it from
              search.
            </p>
          )}
          {(instance.reverseLinks?.length || instance.directLinks?.length) ? (
            <p className="instance-delete-confirm-warning" role="status">
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                className="me-2"
                aria-hidden="true"
              />
              Linked incoming and outgoing relationships will be removed with
              this instance.
            </p>
          ) : null}
          {isNewInstance && (
            <p className="instance-delete-confirm-note">
              This instance has not been saved yet. Deleting it will discard
              the draft.
            </p>
          )}
          <p className="instance-delete-confirm-note mb-0">
            This action cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleCancelDelete}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete}>
            Delete instance
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function InstanceFieldRequiredMark({
  fieldKey,
}: {
  fieldKey: keyof InstanceFieldValues;
}) {
  if (!isMandatoryInstanceField(fieldKey)) {
    return null;
  }

  return (
    <>
      <span className="instance-field-label-required" aria-hidden="true">
        *
      </span>
      <span className="visually-hidden"> (required)</span>
    </>
  );
}

function InstanceViewLabel({
  fieldKey,
  children,
}: {
  fieldKey: keyof InstanceFieldValues;
  children: React.ReactNode;
}) {
  return (
    <div className="view-label">
      {children}
      <InstanceFieldRequiredMark fieldKey={fieldKey} />
    </div>
  );
}

function InstanceFieldLabel({
  fieldKey,
  children,
  isChanged = false,
}: {
  fieldKey: keyof InstanceFieldValues;
  children: React.ReactNode;
  isChanged?: boolean;
}) {
  return (
    <Form.Label
      className={isChanged ? "instance-field-label--changed" : undefined}
    >
      {children}
      <InstanceFieldRequiredMark fieldKey={fieldKey} />
      {isChanged && (
        <span className="instance-field-label-changed-badge">Unsaved</span>
      )}
    </Form.Label>
  );
}
