import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Collapse, Form, Spinner } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronUp,
  faCircle,
  faCircleInfo,
  faCode,
  faCopy,
  faEye,
  faPencil,
  faRocket,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import {
  areInstanceFieldValuesEqual,
  emptyInstanceFieldValues,
  getChangedInstanceFieldKeys,
  getChangedInstanceFieldLabels,
  InstanceFieldValues,
} from "./editorMockData";
import { useAuth } from "../../contexts/AuthContext";
import { useInstances } from "../../contexts/InstancesContext";
import { useUnsavedInstances } from "../../contexts/UnsavedInstancesContext";
import { useSessionStorage } from "../../hooks/useSessionStorage";
import { EDITOR_BREADCRUMB_TRAIL_KEY } from "./editorConstants";
import {
  appendIncomingLinks,
  createInstance,
  fetchIncomingLinks,
  fetchInstance,
  IncomingLinks,
  IncomingLinksOfType,
  InstanceDetail as InstanceDetailData,
  InstanceField,
  updateInstance,
} from "../../services/instances";
import { fetchTypeFields, fetchTypes, typeLabel } from "../../services/types";
import { Breadcrumbs, BreadcrumbItem as BreadcrumbTrailItem } from "../../components/Breadcrumbs";
import InstanceFieldControl from "../../components/InstanceFieldControl";
import InstanceLinksPanel, {
  HoveredLink,
} from "../../components/InstanceLinksPanel";
import IncomingLinksPanel from "../../components/IncomingLinksPanel";
import InstanceLinkConnectors from "../../components/InstanceLinkConnectors";
import UnsavedInstancesPanel from "../../components/UnsavedInstancesPanel";
import RawInstanceEditor from "../../components/RawInstanceEditor";
import InstanceRelease from "../../components/InstanceRelease";
import InstanceInfo from "../../components/InstanceInfo";
import {
  FieldValidationError,
  FieldValidationErrors,
  FieldValidationIndicator,
  InstanceValidationSummary,
  validationErrorsByField,
} from "../../components/InstanceValidation";
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

/** The ways an instance can be shown - switched by the icons in the header */
type InstanceMode = "read" | "edit" | "raw" | "release" | "info";

const INSTANCE_MODES: Array<{ mode: InstanceMode; icon: IconDefinition }> = [
  { mode: "read", icon: faEye },
  { mode: "edit", icon: faPencil },
  { mode: "raw", icon: faCode },
  { mode: "release", icon: faRocket },
  { mode: "info", icon: faCircleInfo },
];

/** Names the change of an instance edited in the raw mode (e.g. in the unsaved instances) */
const RAW_JSON_LABEL = "Raw JSON";

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

const BREADCRUMB_TRAIL_LIMIT = 10;

type BreadcrumbItem = BreadcrumbTrailItem;

function useBreadcrumbTrail(
  instanceId: string,
  instanceName?: string,
  instanceColor?: string,
) {
  const [breadcrumbTrail, setBreadcrumbTrail] = useSessionStorage<
    Array<BreadcrumbItem>
  >(EDITOR_BREADCRUMB_TRAIL_KEY, []);

  useEffect(() => {
    if (!instanceName || !instanceColor) {
      return;
    }

    setBreadcrumbTrail((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === instanceId);
      const item = {
        id: instanceId,
        label: instanceName,
        color: instanceColor,
      };

      if (existingIndex === -1) {
        return [...prev, item].slice(-BREADCRUMB_TRAIL_LIMIT);
      }

      if (existingIndex === prev.length - 1) {
        return [...prev.slice(0, existingIndex), item];
      }

      return prev.slice(0, existingIndex + 1);
    });
  }, [instanceId, instanceName, instanceColor, setBreadcrumbTrail]);

  return breadcrumbTrail;
}

function InstanceDetailView({ instanceId }: { instanceId: string }) {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { addInstance, instances } = useInstances();
  const { getDraft, upsertDraft, removeDraft } = useUnsavedInstances();
  const [searchParams] = useSearchParams();
  const [baseline, setBaseline] = useState<InstanceFieldValues>(
    emptyInstanceFieldValues,
  );
  // Determined once - the instance stays new until it is saved (also when reopened from its unsaved draft)
  const [isNewInstance, setIsNewInstance] = useState(
    () => searchParams.get("new") === "1" || Boolean(getDraft(instanceId)?.isNew),
  );
  /** The identifier of the type of the new instance */
  const newInstanceType = searchParams.get("type") || "";
  const openInEditMode = searchParams.get("edit") === "1";
  const openInRawMode = searchParams.get("raw") === "1" && !isNewInstance;
  const openInReleaseMode = searchParams.get("release") === "1" && !isNewInstance && !openInRawMode;

  const [isEditMode, setIsEditMode] = useState(
    (isNewInstance || openInEditMode) && !openInRawMode && !openInReleaseMode,
  );
  /** Shows the full JSON of the instance instead of its fields (only available when not editing the fields) */
  const [isRawMode, setIsRawMode] = useState(openInRawMode);
  /** Shows the release tree of the instance instead of its fields (only available when not editing the fields) */
  const [isReleaseMode, setIsReleaseMode] = useState(openInReleaseMode);
  /** Shows the administrative information of the instance (timestamps, contributors) instead of its fields */
  const [isInfoMode, setIsInfoMode] = useState(false);
  const [currentFieldValues, setCurrentFieldValues] =
    useState<InstanceFieldValues>(emptyInstanceFieldValues);
  /** The property of the type of the new instance which names its instances */
  const [newInstanceLabelProperty, setNewInstanceLabelProperty] = useState<string>();

  const [instance, setInstance] = useState<InstanceDetailData | undefined>(
    () =>
      isNewInstance
        ? {
            instanceId,
            type: newInstanceType,
            instanceName: instanceId,
            space: "",
            permissions: "",
            releaseStatus: "in progress",
            directLinks: [],
          }
        : undefined,
  );
  /** The linked instance hovered - either in the form or in the outgoing links */
  const [hoveredLink, setHoveredLink] = useState<HoveredLink>();
  const [layoutEl, setLayoutEl] = useState<HTMLDivElement | null>(null);
  // New instances are only loading while the fields of their type are fetched
  const [loading, setLoading] = useState(!isNewInstance || Boolean(newInstanceType));
  const [loadError, setLoadError] = useState<string>();
  const [incomingLinks, setIncomingLinks] = useState<IncomingLinks[]>([]);
  const [incomingLinksLoading, setIncomingLinksLoading] =
    useState(!isNewInstance);
  const [incomingLinksError, setIncomingLinksError] = useState<string>();
  /** The groups of incoming links whose following page is being loaded (by property and type) */
  const [incomingLinksLoadingMore, setIncomingLinksLoadingMore] = useState<
    Set<string>
  >(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

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

  // A new instance is filled in with the (empty) fields of its type - and shown with the name and color of the type
  useEffect(() => {
    if (!isNewInstance || !newInstanceType) {
      return;
    }

    let cancelled = false;
    getAccessToken()
      .then((token) =>
        Promise.all([
          fetchTypeFields(token, newInstanceType),
          fetchTypes(token),
        ]),
      )
      .then(([fields, types]) => {
        if (cancelled) {
          return;
        }
        const type = types.find((t) => t.identifier === newInstanceType);
        setNewInstanceLabelProperty(type?.labelProperty);
        setInstance((current) =>
          current && {
            ...current,
            type: typeLabel(type ?? { identifier: newInstanceType }),
            typeColor: type?.color,
            typeDescription: type?.description,
            fields,
          },
        );
      })
      .catch((e: unknown) => {
        console.error("Failed to load the fields of the type", e);
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isNewInstance, newInstanceType]);

  useEffect(() => {
    if (isNewInstance) {
      return;
    }

    let cancelled = false;
    getAccessToken()
      .then((token) => fetchIncomingLinks(token, instanceId))
      .then((loaded) => !cancelled && setIncomingLinks(loaded))
      .catch((e: unknown) => {
        console.error("Failed to load the incoming links", e);
        if (!cancelled) {
          setIncomingLinksError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => !cancelled && setIncomingLinksLoading(false));
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, instanceId, isNewInstance]);

  /** Reloads the instance after it was replaced in the raw mode - its fields and links are shown as stored by the core. */
  const reloadInstance = useCallback(() => {
    getAccessToken()
      .then((token) => fetchInstance(token, instanceId))
      .then(setInstance)
      .catch((e: unknown) => console.error("Failed to reload the instance", e));
  }, [getAccessToken, instanceId]);

  const loadMoreIncomingLinks = useCallback(
    (property: string, type: IncomingLinksOfType) => {
      const marker = type.nextMarker;
      if (!marker) {
        return;
      }
      const key = `${property} ${type.typeIdentifier}`;
      setIncomingLinksLoadingMore((prev) => new Set(prev).add(key));
      getAccessToken()
        .then((token) => fetchIncomingLinks(token, instanceId, marker))
        .then((nextPage) =>
          setIncomingLinks((current) =>
            appendIncomingLinks(
              current,
              property,
              type.typeIdentifier,
              nextPage,
            ),
          ),
        )
        .catch((e: unknown) =>
          console.error("Failed to load more incoming links", e),
        )
        .finally(() =>
          setIncomingLinksLoadingMore((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          }),
        );
    },
    [getAccessToken, instanceId],
  );

  const isLoadingMoreIncomingLinks = useCallback(
    (property: string, typeIdentifier: string) =>
      incomingLinksLoadingMore.has(`${property} ${typeIdentifier}`),
    [incomingLinksLoadingMore],
  );

  const typeColor =
    instance?.typeColor || (instance && typeColors[instance.type]) || "#6c757d";

  // A new instance is named by the value of the label field of its type as it is filled in - by its id if there is none
  // (as the instances provided by the backend)
  const newInstanceLabel = newInstanceLabelProperty
    ? currentFieldValues[newInstanceLabelProperty]
    : undefined;
  const instanceName =
    isNewInstance && instance
      ? typeof newInstanceLabel === "string" && newInstanceLabel.trim()
        ? newInstanceLabel.trim()
        : instanceId
      : instance?.instanceName;

  const breadcrumbTrail = useBreadcrumbTrail(
    instanceId,
    instanceName,
    typeColor,
  );

  const fields = useMemo(() => instance?.fields ?? [], [instance]);

  // Unsupported fields are shown separately (alphabetically) at the bottom of the view
  const supportedFields = useMemo(
    () => fields.filter((field) => field.kind !== "UNSUPPORTED"),
    [fields],
  );
  const unsupportedFields = useMemo(
    () =>
      fields
        .filter((field) => field.kind === "UNSUPPORTED")
        .sort((a, b) => a.label.localeCompare(b.label)),
    [fields],
  );

  /** The errors of the last validation by the identifier of the field they concern */
  const fieldErrors = useMemo(
    () => validationErrorsByField(instance?.validation),
    [instance],
  );
  const fieldLabels = useMemo(
    () => new Map(fields.map((field) => [field.identifier, field.label])),
    [fields],
  );

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
    if (!instanceId) {
      return;
    }

    const draft = getDraft(instanceId);

    if (draft?.rawJson !== undefined) {
      setCurrentFieldValues(savedFieldValues);
      setBaseline(savedFieldValues);
      setIsEditMode(false);
      setIsRawMode(true);
      setIsReleaseMode(false);
      setIsInfoMode(false);
      return;
    }

    if (draft) {
      setCurrentFieldValues(draft.fieldValues);
      setBaseline(savedFieldValues);
      setIsEditMode(true);
      setIsRawMode(false);
      setIsReleaseMode(false);
      setIsInfoMode(false);
      return;
    }

    setCurrentFieldValues(savedFieldValues);
    setBaseline(savedFieldValues);
    setIsEditMode(
      (isNewInstance || openInEditMode) && !openInRawMode && !openInReleaseMode,
    );
    setIsRawMode(openInRawMode);
    setIsReleaseMode(openInReleaseMode);
    setIsInfoMode(false);
    // Only re-initialize when navigating between instances or once the instance is loaded — not when unrelated
    // drafts are added (getDraft identity changes would exit edit mode otherwise).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedFieldValues, instanceId, isNewInstance, openInEditMode, openInRawMode, openInReleaseMode]);

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

  const rawDraft = getDraft(instanceId)?.rawJson;
  const hasUnsavedChanges =
    (isEditMode && changedFieldKeys.size > 0) || rawDraft !== undefined;
  const unsavedChangeLabels =
    rawDraft !== undefined ? [RAW_JSON_LABEL] : changedFieldLabels;

  useEffect(() => {
    if (!instanceId || !instance || !isEditMode) {
      return;
    }

    if (!areInstanceFieldValuesEqual(currentFieldValues, baseline)) {
      upsertDraft({
        instanceId,
        instanceName: instanceName ?? instance.instanceName,
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
    instanceName,
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

  const canEdit = instance.permissions
    .split(",")
    .some((permission) => permission.trim() === "Edit");

  /** Keeps the JSON edited in the raw mode as a draft - so it is listed with the unsaved instances. */
  const handleRawDraftChange = (rawJson: string | undefined) => {
    if (rawJson === undefined) {
      removeDraft(instanceId);
      return;
    }
    upsertDraft({
      instanceId,
      instanceName: instanceName ?? instance.instanceName,
      type: instance.type,
      fieldValues: savedFieldValues,
      updatedAt: Date.now(),
      changedFieldLabels: [RAW_JSON_LABEL],
      rawJson,
    });
  };

  const handleRawSaved = () => {
    removeDraft(instanceId);
    reloadInstance();
  };

  const mode: InstanceMode = isInfoMode ? "info" : isReleaseMode ? "release" : isRawMode ? "raw" : isEditMode  ? "edit" : "read";

  /** Leaves the current mode - unsaved changes (of the fields or the JSON) are discarded after confirmation. */
  const leaveMode = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        `Discard the unsaved changes of ${instanceName}?`,
      )
    ) {
      return false;
    }
    removeDraft(instanceId);
    resetToSaved();
    setIsRawMode(false);
    setIsReleaseMode(false);
    setIsInfoMode(false);
    return true;
  };

  const switchMode = (target: InstanceMode) => {
    if (target === mode || !leaveMode()) {
      return;
    }
    if (target === "edit") {
      setBaseline(savedFieldValues);
      setIsEditMode(true);
    } else if (target === "raw") {
      setIsRawMode(true);
    } else if (target === "release") {
      setIsReleaseMode(true);
    } else if (target === "info") {
      setIsInfoMode(true);
    }
  };

  const modeTitles: Record<InstanceMode, string> = {
    read: "Read",
    edit: "Edit",
    raw: canEdit ? "Show and edit the raw JSON" : "Show the raw JSON",
    release: "Release",
    info: "Information",
  };

  const handleSave = () => {
    // Only the changed fields are sent - the other properties of the instance are kept as they are (all the fields
    // filled in for a new instance)
    const changes = Object.fromEntries(
      [...changedFieldKeys].map((key) => [key, currentFieldValues[key] ?? null]),
    );
    setSaving(true);
    setSaveError(undefined);
    getAccessToken()
      .then((token) =>
        isNewInstance
          ? createInstance(token, instanceId, newInstanceType, changes)
          : updateInstance(token, instanceId, changes),
      )
      .then((stored) => {
        removeDraft(instanceId);
        setInstance(stored);
        setIsEditMode(false);
        if (isNewInstance) {
          setIsNewInstance(false);
          addInstance({
            id: instances.length + 1,
            instanceId: stored.instanceId,
            type: stored.type,
            typeColor: stored.typeColor,
            instanceName: stored.instanceName,
            space: stored.space,
            permissions: stored.permissions,
            favorite: false,
            contributed: true,
            releaseStatus: stored.releaseStatus,
          });
          // The instance is known to the core from now on - it is shown as any other instance
          navigate(`/editor/instances/${stored.instanceId}`, { replace: true });
        }
      })
      .catch((e: unknown) => {
        console.error("Failed to save the instance", e);
        setSaveError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setSaving(false));
  };

  /** Reverts the changed fields - stays in the edit mode (like the reset of the raw mode). */
  const handleReset = () => {
    removeDraft(instanceId || "");
    setSaveError(undefined);
    setCurrentFieldValues(baseline);
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
    const hasReverseLinks = incomingLinks.length > 0;

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
      <div className="instance-detail-layout" ref={setLayoutEl}>
        <InstanceLinkConnectors layout={layoutEl} />
        <Breadcrumbs
          items={[
            { id: "__editor__", label: "Editor" },
            ...breadcrumbTrail,
          ]}
          onItemClick={(item, index) => {
            if (index === 0) {
              navigate("/editor");
            } else {
              navigate(`/editor/instances/${item.id}`);
            }
          }}
          className="instance-detail-breadcrumbs"
        />
        <aside className="instance-detail-side instance-detail-side--reverse">
          <IncomingLinksPanel
            incomingLinks={incomingLinks}
            loading={incomingLinksLoading}
            error={incomingLinksError}
            onLinkClick={handleLinkClick}
            onLoadMore={loadMoreIncomingLinks}
            isLoadingMore={isLoadingMoreIncomingLinks}
          />
        </aside>

        <div className="instance-detail-main">
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
                  <h2 className="instance-name">{instanceName}</h2>
                  {hasUnsavedChanges && (
                    <div className="instance-unsaved-summary" role="status">
                      Unsaved changes
                      {unsavedChangeLabels.length > 0 && (
                        <span className="instance-unsaved-summary-fields">
                          {" "}
                          · {unsavedChangeLabels.join(", ")}
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
                  {!isNewInstance && instance.validation && instance.validation.length > 0 && (
                    <InstanceValidationSummary
                      validation={instance.validation}
                      fieldLabels={fieldLabels}
                    />
                  )}
                </div>
                <div className="d-flex flex-column align-items-end gap-2">
                  {!isNewInstance && (
                    <div
                      className="d-flex gap-1"
                      role="group"
                      aria-label="Mode"
                    >
                      {INSTANCE_MODES.map(({ mode: target, icon }) => (
                        <Button
                          key={target}
                          variant="link"
                          className={`edit-icon-btn${mode === target ? " edit-icon-btn--active" : ""}`}
                          onClick={() => switchMode(target)}
                          aria-label={modeTitles[target]}
                          aria-pressed={mode === target}
                          title={modeTitles[target]}
                        >
                          <FontAwesomeIcon icon={icon} />
                        </Button>
                      ))}
                    </div>
                  )}
                  <img
                    src={getLinkStatusIcon()}
                    alt="Link status"
                    className="link-status-icon"
                  />
                </div>
              </div>
            </div>

            {isInfoMode ? (
              <InstanceInfo instanceId={instanceId} />
            ) : isReleaseMode ? (
              <InstanceRelease
                instanceId={instanceId}
                onInstanceClick={handleLinkClick}
              />
            ) : isRawMode ? (
              <RawInstanceEditor
                instanceId={instanceId}
                canEdit={canEdit}
                draftText={rawDraft}
                onDraftChange={handleRawDraftChange}
                onSaved={handleRawSaved}
              />
            ) : (
              <>
                {fields.length === 0 && (
                  <p className="text-muted">
                    {isNewInstance && loadError
                      ? `The fields of the type could not be loaded: ${loadError}`
                      : "This instance has no fields."}
                  </p>
                )}
                {!isEditMode ? (
                  <div className="instance-view">
                    {supportedFields.map((field) => (
                      <div key={field.identifier} {...fieldSectionProps(field)}>
                        <ViewFieldLabel
                          tooltip={field.tooltip}
                          validationErrors={fieldErrors.get(field.identifier)}
                        >
                          {field.label}
                        </ViewFieldLabel>
                        <InstanceFieldControl
                          field={field}
                          value={currentFieldValues[field.identifier]}
                          onChange={(value) =>
                            setFieldValue(field.identifier, value)
                          }
                          isEditMode={false}
                          onInstanceClick={handleLinkClick}
                          {...linkHoverProps(field)}
                        />
                        <FieldErrors errors={fieldErrors.get(field.identifier)} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="instance-form">
                    {supportedFields.map((field) => (
                      <Form.Group key={field.identifier} {...fieldSectionProps(field)}>
                        <InstanceFieldLabel
                          isChanged={changedFieldKeys.has(field.identifier)}
                          tooltip={field.tooltip}
                          validationErrors={fieldErrors.get(field.identifier)}
                        >
                          {field.label}
                          {field.required && " *"}
                        </InstanceFieldLabel>
                        <InstanceFieldControl
                          field={field}
                          value={currentFieldValues[field.identifier]}
                          onChange={(value) =>
                            setFieldValue(field.identifier, value)
                          }
                          isEditMode
                          onInstanceClick={handleLinkClick}
                          currentInstanceId={instanceId}
                          parentSpace={instance.space}
                          {...linkHoverProps(field)}
                        />
                        <FieldErrors errors={fieldErrors.get(field.identifier)} />
                      </Form.Group>
                    ))}

                    {unsupportedFields.length > 0 && (
                      <UnsupportedFieldsSection
                        fields={unsupportedFields}
                        values={currentFieldValues}
                        onChange={setFieldValue}
                        isEditMode
                        changedFieldKeys={changedFieldKeys}
                        fieldErrors={fieldErrors}
                        onInstanceClick={handleLinkClick}
                      />
                    )}

                    {saveError && (
                      <Alert variant="danger" className="mt-3 mb-0">
                        {saveError}
                      </Alert>
                    )}
                    <div className="d-flex gap-2 mt-4">
                      <Button
                        variant="dark"
                        onClick={handleSave}
                        disabled={changedFieldKeys.size === 0 || saving}
                      >
                        {saving && (
                          <Spinner animation="border" size="sm" className="me-2" />
                        )}
                        Save
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={handleReset}
                        disabled={changedFieldKeys.size === 0 || saving}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                )}

                {!isEditMode && unsupportedFields.length > 0 && (
                  <UnsupportedFieldsSection
                    fields={unsupportedFields}
                    values={currentFieldValues}
                    onChange={setFieldValue}
                    isEditMode={false}
                    changedFieldKeys={changedFieldKeys}
                    fieldErrors={fieldErrors}
                    onInstanceClick={handleLinkClick}
                  />
                )}
              </>
            )}
          </div>
        </div>

        <aside className="instance-detail-side instance-detail-side--direct">
          <InstanceLinksPanel
            links={instance?.directLinks || []}
            onLinkClick={handleLinkClick}
            title="Outgoing Links"
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

/** The fields not supported by the editor (yet) - shown as raw JSON and collapsed by default. */
function UnsupportedFieldsSection({
  fields,
  values,
  onChange,
  isEditMode,
  changedFieldKeys,
  fieldErrors,
  onInstanceClick,
}: {
  fields: InstanceField[];
  values: InstanceFieldValues;
  onChange: (identifier: string, value: unknown) => void;
  isEditMode: boolean;
  changedFieldKeys: Set<string>;
  fieldErrors: Map<string, FieldValidationError[]>;
  onInstanceClick: (instanceId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  // The section is flagged if any of its fields is - so the errors aren't missed while it is collapsed
  const errors = fields.flatMap((field) => fieldErrors.get(field.identifier) ?? []);
  return (
    <div className="instance-unsupported-fields">
      <Button
        type="button"
        variant="link"
        size="sm"
        className="instance-unsupported-fields-toggle p-0"
        onClick={() => setIsExpanded((previous) => !previous)}
        aria-expanded={isExpanded}
        aria-controls="instance-unsupported-fields-list"
      >
        Unsupported fields ({fields.length})
        {errors.length > 0 && <FieldValidationIndicator errors={errors} />}
        <FontAwesomeIcon
          icon={isExpanded ? faChevronUp : faChevronDown}
          className="ms-2 instance-unsupported-fields-toggle-icon"
        />
      </Button>
      <Collapse in={isExpanded}>
        <div id="instance-unsupported-fields-list">
          <div className={isEditMode ? "instance-form" : "instance-view"}>
            {fields.map((field) => {
              const control = (
                <InstanceFieldControl
                  field={field}
                  value={values[field.identifier]}
                  onChange={(value) => onChange(field.identifier, value)}
                  isEditMode={isEditMode}
                  onInstanceClick={onInstanceClick}
                />
              );
              return isEditMode ? (
                <Form.Group key={field.identifier} {...fieldSectionProps(field)}>
                  <InstanceFieldLabel
                    isChanged={changedFieldKeys.has(field.identifier)}
                    tooltip={field.tooltip}
                    validationErrors={fieldErrors.get(field.identifier)}
                  >
                    {field.label}
                    {field.required && " *"}
                  </InstanceFieldLabel>
                  {control}
                  <FieldErrors errors={fieldErrors.get(field.identifier)} />
                </Form.Group>
              ) : (
                <div key={field.identifier} {...fieldSectionProps(field)}>
                  <ViewFieldLabel
                    tooltip={field.tooltip}
                    validationErrors={fieldErrors.get(field.identifier)}
                  >
                    {field.label}
                  </ViewFieldLabel>
                  {control}
                  <FieldErrors errors={fieldErrors.get(field.identifier)} />
                </div>
              );
            })}
          </div>
        </div>
      </Collapse>
    </div>
  );
}

function fieldSectionProps(field: InstanceField) {
  return {
    className: "mb-4 instance-field-section",
    "data-instance-field": field.label.trim(),
  };
}

/** The label of a field in the read mode - flagged if the validation reports errors for the field. */
function ViewFieldLabel({
  children,
  tooltip,
  validationErrors,
}: {
  children: React.ReactNode;
  tooltip?: string;
  validationErrors?: FieldValidationError[];
}) {
  return (
    <div className="view-label" title={tooltip}>
      {children}
      {validationErrors && <FieldValidationIndicator errors={validationErrors} />}
    </div>
  );
}

function FieldErrors({ errors }: { errors?: FieldValidationError[] }) {
  return errors ? <FieldValidationErrors errors={errors} /> : null;
}

function InstanceFieldLabel({
  children,
  isChanged = false,
  tooltip,
  validationErrors,
}: {
  children: React.ReactNode;
  isChanged?: boolean;
  tooltip?: string;
  validationErrors?: FieldValidationError[];
}) {
  return (
    <Form.Label
      className={isChanged ? "instance-field-label--changed" : undefined}
      title={tooltip}
    >
      {children}
      {validationErrors && <FieldValidationIndicator errors={validationErrors} />}
      {isChanged && (
        <span className="instance-field-label-changed-badge">Unsaved</span>
      )}
    </Form.Label>
  );
}
