import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Breadcrumb, Button, Form, Spinner } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faCopy, faPencil } from "@fortawesome/free-solid-svg-icons";
import {
  areInstanceFieldValuesEqual,
  emptyInstanceFieldValues,
  getChangedInstanceFieldKeys,
  getChangedInstanceFieldLabels,
  InstanceFieldValues,
  InstanceSummary
} from "./editorMockData";
import { useAuth } from "../../contexts/AuthContext";
import { useInstances } from "../../contexts/InstancesContext";
import {
  fetchInstance,
  InstanceDetail as InstanceDetailData,
  InstanceField,
} from "../../services/instances";
import { useUnsavedInstances } from "../../contexts/UnsavedInstancesContext";
import InstanceFieldControl from "../../components/InstanceFieldControl";
import InstanceLinksPanel, {
  HoveredLink,
} from "../../components/InstanceLinksPanel";
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
  const { getAccessToken } = useAuth();
  const { addInstance, instances } = useInstances();
  const { getDraft, upsertDraft, removeDraft } = useUnsavedInstances();
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search),
  );
  const [baseline, setBaseline] = useState<InstanceFieldValues>(
    emptyInstanceFieldValues,
  );

  const [breadcrumbTrail, setBreadcrumbTrail] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const isNewInstance = instanceId?.startsWith("new-");
  const newInstanceName = searchParams.get("name") || "";
  const newInstanceType = searchParams.get("type") || "";

  const [isEditMode, setIsEditMode] = useState(isNewInstance);
  const [currentFieldValues, setCurrentFieldValues] =
    useState<InstanceFieldValues>(emptyInstanceFieldValues);

  const [instance, setInstance] = useState<InstanceDetailData | undefined>(
    () =>
      isNewInstance
        ? {
            instanceId,
            type: newInstanceType,
            instanceName: newInstanceName,
            space: "",
            permissions: "",
            releaseStatus: "in progress",
            directLinks: [],
            reverseLinks: [],
          }
        : undefined,
  );
  /** The linked instance hovered - either in the form or in the outgoing links */
  const [hoveredLink, setHoveredLink] = useState<HoveredLink>();
  const [loading, setLoading] = useState(!isNewInstance);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    if (isNewInstance) {
      return;
    }

    let cancelled = false;
    getAccessToken()
      .then((token) => fetchInstance(token, instanceId))
      .then((loaded) => !cancelled && setInstance(loaded))
      .catch((e: unknown) => {
        console.error("Failed to load the instance", e);
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, instanceId, isNewInstance]);

  const typeColor =
    instance?.typeColor || (instance && typeColors[instance.type]) || "#6c757d";

  const fields = useMemo(() => instance?.fields ?? [], [instance]);

  const savedFieldValues = useMemo<InstanceFieldValues>(
    () =>
      Object.fromEntries(
        fields.map((field) => [field.identifier, field.value ?? null]),
      ),
    [fields],
  );

  const setFieldValue = useCallback((identifier: string, value: unknown) => {
    setCurrentFieldValues((values) => ({ ...values, [identifier]: value }));
  }, []);

  const resetToSaved = useCallback(() => {
    setCurrentFieldValues(savedFieldValues);
    setIsEditMode(false);
  }, [savedFieldValues]);

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

    const draft = getDraft(instanceId);

    if (draft) {
      setCurrentFieldValues(draft.fieldValues);
      setBaseline(savedFieldValues);
      setIsEditMode(true);
      return;
    }

    setCurrentFieldValues(savedFieldValues);
    setBaseline(savedFieldValues);
    setIsEditMode(Boolean(isNewInstance));
    // Only re-initialize when navigating between instances or once the instance is loaded — not when unrelated
    // drafts are added (getDraft identity changes would exit edit mode otherwise).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedFieldValues, instanceId, isNewInstance]);

  const changedFieldKeys = useMemo(() => {
    if (!isEditMode) {
      return new Set<string>();
    }

    return new Set(getChangedInstanceFieldKeys(currentFieldValues, baseline));
  }, [baseline, currentFieldValues, isEditMode]);

  const changedFieldLabels = useMemo(
    () => getChangedInstanceFieldLabels(currentFieldValues, baseline, fields),
    [baseline, currentFieldValues, fields],
  );

  const hasUnsavedChanges = isEditMode && changedFieldKeys.size > 0;

  useEffect(() => {
    if (!instanceId || !instance || !isEditMode) {
      return;
    }

    if (!areInstanceFieldValuesEqual(currentFieldValues, baseline)) {
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
    baseline,
    changedFieldLabels,
    currentFieldValues,
    instance,
    instanceId,
    isEditMode,
    isNewInstance,
    removeDraft,
    upsertDraft,
  ]);

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" role="status" className="me-2" />
        Loading instance...
      </div>
    );
  }

  if (!instance) {
    return (
      <div>
        <h2>Instance not found</h2>
        <p>No instance found with ID: {instanceId}</p>
        {loadError && <p className="text-muted">{loadError}</p>}
      </div>
    );
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(instanceId || "");
  };

  const handleEdit = () => {
    setBaseline(savedFieldValues);
    setIsEditMode(true);
  };

  const handleSave = () => {
    if (isNewInstance) {
      const newId = `inst-${crypto.randomUUID()}`;

      const newInstance: InstanceSummary = {
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
      navigate(`/editor/instances/${newId}`);
      return;
    }

    removeDraft(instanceId || "");
    setBaseline(currentFieldValues);
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
    navigate(`/editor/instances/${linkedInstanceId}`);
  };

  /** Highlights a linked instance in a field together with its representation in the outgoing links (and vice versa) when hovered. */
  const linkHoverProps = (field: InstanceField) => {
    if (field.kind !== "LINK" && field.kind !== "LINKS") {
      return {};
    }
    const fieldLabel = field.label.trim();
    return {
      highlightedInstanceId:
        hoveredLink?.fieldLabel === fieldLabel
          ? hoveredLink.instanceId
          : undefined,
      onInstanceHover: (instanceId: string | undefined) =>
        setHoveredLink(instanceId ? { fieldLabel, instanceId } : undefined),
    };
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
                      : () => navigate(`/editor/instances/${item.id}`)
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

            {fields.length === 0 && (
              <p className="text-muted">
                {isNewInstance
                  ? "The fields of new instances are not available yet."
                  : "This instance has no fields."}
              </p>
            )}
            {!isEditMode ? (
              <div className="instance-view">
                {fields.map((field) => (
                  <div key={field.identifier} className="mb-4">
                    <div className="view-label" title={field.tooltip}>
                      {field.label}
                    </div>
                    <InstanceFieldControl
                      field={field}
                      value={currentFieldValues[field.identifier]}
                      onChange={(value) => setFieldValue(field.identifier, value)}
                      isEditMode={false}
                      onInstanceClick={handleLinkClick}
                      {...linkHoverProps(field)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="instance-form">
                {fields.map((field) => (
                  <Form.Group key={field.identifier} className="mb-4">
                    <InstanceFieldLabel
                      isChanged={changedFieldKeys.has(field.identifier)}
                      tooltip={field.tooltip}
                    >
                      {field.label}
                      {field.required && " *"}
                    </InstanceFieldLabel>
                    <InstanceFieldControl
                      field={field}
                      value={currentFieldValues[field.identifier]}
                      onChange={(value) => setFieldValue(field.identifier, value)}
                      isEditMode
                      onInstanceClick={handleLinkClick}
                      currentInstanceId={instanceId}
                      parentSpace={instance.space}
                      {...linkHoverProps(field)}
                    />
                  </Form.Group>
                ))}

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
            highlightedLink={hoveredLink}
            onLinkHover={setHoveredLink}
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
  tooltip,
}: {
  children: React.ReactNode;
  isChanged?: boolean;
  tooltip?: string;
}) {
  return (
    <Form.Label
      className={isChanged ? "instance-field-label--changed" : undefined}
      title={tooltip}
    >
      {children}
      {isChanged && (
        <span className="instance-field-label-changed-badge">Unsaved</span>
      )}
    </Form.Label>
  );
}
