import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Collapse, Form, Modal, Spinner } from "react-bootstrap";
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
  faTriangleExclamation,
  faUserPlus,
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
  deleteInstance,
  fetchIncomingLinks,
  fetchInstance,
  IDENTIFIER,
  IncomingLinks,
  IncomingLinksOfType,
  InstanceDetail as InstanceDetailData,
  InstanceField,
  updateInstance,
} from "../../services/instances";
import { fetchTypeFields, fetchTypes, typeLabel } from "../../services/types";
import { Breadcrumbs, BreadcrumbItem as BreadcrumbTrailItem } from "../../components/Breadcrumbs";
import { FieldAlternativesControls, useFieldAlternatives } from "../../components/InstanceAlternatives";
import InstanceFieldControl from "../../components/InstanceFieldControl";
import InstanceHeaderSection from "../../components/InstanceHeaderSection";
import InstanceIdentifiers from "../../components/InstanceIdentifiers";
import InstanceLinksPanel, {
  HoveredLink,
} from "../../components/InstanceLinksPanel";
import IncomingLinksPanel from "../../components/IncomingLinksPanel";
import InstanceLinkConnectors from "../../components/InstanceLinkConnectors";
import UnsavedActionDialog, { orderDraftsForSave } from "../../components/UnsavedActionDialog";
import { isCreatedInstance, persistUnsavedDraft } from "../../components/persistUnsavedDraft";
import UnsavedInstancesPanel from "../../components/UnsavedInstancesPanel";
import RawInstanceEditor from "../../components/RawInstanceEditor";
import InstanceRelease from "../../components/InstanceRelease";
import InstanceInfo from "../../components/InstanceInfo";
import { DisabledHint, noPermission } from "../../components/DisabledHint";
import InstanceReview from "../../components/InstanceReview";
import { FieldComments, InstanceCommentsOverview } from "../../components/InstanceComments";
import { useInstanceComments } from "../../hooks/useInstanceComments";
import { InstanceStatusTags } from "../../components/InstanceStatusTags";
import {
  FieldValidationError,
  FieldValidationErrors,
  FieldValidationIndicator,
  InstanceValidationSection,
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
type InstanceMode = "read" | "edit" | "raw" | "release" | "info" | "review";

/** The first of the modes allowed (in the order of precedence given) - the read mode if none is */
const firstAllowedMode = (modes: Array<[InstanceMode, boolean]>): InstanceMode =>
  modes.find(([, allowed]) => allowed)?.[0] ?? "read";

const INSTANCE_MODES: Array<{ mode: InstanceMode; icon: IconDefinition }> = [
  { mode: "read", icon: faEye },
  { mode: "edit", icon: faPencil },
  { mode: "review", icon: faUserPlus },
  { mode: "release", icon: faRocket },
  { mode: "raw", icon: faCode },
  { mode: "info", icon: faCircleInfo },
];

/** The modes which are kept in the URL (e.g. ?edit=1) - without any of them, the instance is shown in the read mode */
const URL_MODES: InstanceMode[] = ["raw", "release", "edit", "info", "review"];

const modeFromUrl = (searchParams: URLSearchParams): InstanceMode =>
  URL_MODES.find((mode) => searchParams.get(mode) === "1") ?? "read";

const modeSearch = (mode: InstanceMode) => (mode === "read" ? "" : `?${mode}=1`);

/** Names the change of an instance edited in the raw mode (e.g. in the unsaved instances) */
const RAW_JSON_LABEL = "Raw JSON";

/** Names the change of the identifiers (which are no field) */
const IDENTIFIERS_LABEL = "Identifiers";

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

function InstanceDetailView({ instanceId }: Readonly<{ instanceId: string }>) {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { addInstance, deleteInstances, instances } = useInstances();
  const { drafts: unsavedDrafts, getDraft, upsertDraft, removeDraft } = useUnsavedInstances();
  const [searchParams, setSearchParams] = useSearchParams();
  const [baseline, setBaseline] = useState<InstanceFieldValues>(
    emptyInstanceFieldValues,
  );
  // Determined once - the instance stays new until it is saved (also when reopened from its unsaved draft)
  const [isNewInstance, setIsNewInstance] = useState(
    () => searchParams.get("new") === "1" || Boolean(getDraft(instanceId)?.isNew),
  );
  /** The identifier of the type of the new instance - a reopened draft is opened without it in the URL */
  const [newInstanceType] = useState(
    () => searchParams.get("type") || getDraft(instanceId)?.typeIdentifier || "",
  );
  /** The space the new instance is created in (chosen when it was created for a link) */
  const [newInstanceSpace] = useState(() => getDraft(instanceId)?.space);
  /**
   * The mode asked for by the URL - a new instance always shows its form. It is kept when navigating between instances
   * and stays even if the user lacks the permission for it on one of them (see mode): the next instance they are allowed
   * to use it on shows it again.
   */
  const location = useLocation();
  /** Where the instance was when it got created - it stays in the edit mode until the URL tells so */
  const [createdAtLocation, setCreatedAtLocation] = useState<string>();
  const requestedMode: InstanceMode =
    isNewInstance || createdAtLocation === location.key ? "edit" : modeFromUrl(searchParams);
  const requestMode = useCallback(
    (target: InstanceMode) => {
      if (target === requestedMode) {
        return;
      }
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          URL_MODES.forEach((urlMode) => next.delete(urlMode));
          if (target !== "read") {
            next.set(target, "1");
          }
          return next;
        },
        { replace: true },
      );
    },
    [requestedMode, setSearchParams],
  );
  /** Shows the comments on the instance as a whole */
  const [isInstanceCommentsOpen, setIsInstanceCommentsOpen] = useState(true);
  const [currentFieldValues, setCurrentFieldValues] =
    useState<InstanceFieldValues>(emptyInstanceFieldValues);
  /** Whether the values of the loaded instance (or its draft) were taken over - they are empty until then */
  const [isFieldValuesReady, setIsFieldValuesReady] = useState(false);
  /** The property of the type of the new instance which names its instances */
  const [newInstanceLabelProperty, setNewInstanceLabelProperty] = useState<string>();

  const [instance, setInstance] = useState<InstanceDetailData | undefined>(
    () =>
      isNewInstance
        ? {
            instanceId,
            type: newInstanceType,
            instanceName: "New instance",
            space: newInstanceSpace ?? "",
            permissions: "",
            releaseStatus: "in progress",
            directLinks: [],
          }
        : undefined,
  );
  const permissions = instance?.permissions.split(",").map((permission) => permission.trim()) ?? [];
  const canEdit = permissions.includes("Edit");
  /** Whether the user may invite others to review the instance */
  const canReview = permissions.includes("Review");
  // The invitations are only shown with the right to invite (also when requested by the URL)
  const isReviewMode = requestedMode === "review" && canReview;
  // A new instance is created by the user - an existing one is only edited with the right to edit it (also when
  // requested by the URL or an unsaved draft)
  const isEditMode = requestedMode === "edit" && (isNewInstance || canEdit);
  const canRelease = permissions.includes("Release");
  /** Whether the user may read and write comments (reviewers and above) */
  const canComment = permissions.includes("Comment");
  /** Whether the user may delete the comments of others (the authors can always delete their own ones) */
  const canModerateComments = permissions.includes("Manage");
  const comments = useInstanceComments(instanceId, canComment && !isNewInstance);

  useEffect(() => {
    setIsInstanceCommentsOpen(true);
  }, [instanceId]);
  // The release tree is only shown with the right to release the instance (also when requested by the URL)
  const isReleaseMode = requestedMode === "release" && canRelease;
  const isRawMode = requestedMode === "raw";
  const isInfoMode = requestedMode === "info";
  // Falls back to the read mode if the user lacks the permission for the mode requested
  const mode = firstAllowedMode([
    ["review", isReviewMode],
    ["info", isInfoMode],
    ["release", isReleaseMode],
    ["raw", isRawMode],
    ["edit", isEditMode],
  ]);
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [saveIncludedIds, setSaveIncludedIds] = useState<string[]>([]);
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

  // A new instance is named by the value of the label field of its type as it is filled in.
  // Until then the title is "New instance". A stored instance with no label keeps its id.
  const newInstanceLabel = newInstanceLabelProperty
    ? currentFieldValues[newInstanceLabelProperty]
    : undefined;
  const instanceName =
    isNewInstance && instance
      ? typeof newInstanceLabel === "string" && newInstanceLabel.trim()
        ? newInstanceLabel.trim()
        : "New instance"
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
  /** The properties with a comment thread at their field - the comments on other properties are listed in the overview */
  const fieldProperties = useMemo(
    () => new Set(supportedFields.map((field) => field.identifier)),
    [supportedFields],
  );
  const fieldLabels = useMemo(
    () => new Map(fields.map((field) => [field.identifier, field.label])),
    [fields],
  );
  /** The fields and the identifiers - as their changes are named */
  const changeLabels = useMemo(
    () => [...fields, { identifier: IDENTIFIER, label: IDENTIFIERS_LABEL }],
    [fields],
  );

  const savedIdentifiers = useMemo(() => instance?.identifiers ?? [], [instance]);
  // The identifiers are edited (and saved) like a field - the backend only adds them though
  const savedFieldValues = useMemo<InstanceFieldValues>(
    () => ({
      ...Object.fromEntries(
        fields.map((field) => [field.identifier, field.value ?? null]),
      ),
      [IDENTIFIER]: savedIdentifiers,
    }),
    [fields, savedIdentifiers],
  );

  const setFieldValue = useCallback((identifier: string, value: unknown) => {
    setCurrentFieldValues((values) => ({ ...values, [identifier]: value }));
  }, []);

  const resetToSaved = useCallback(() => {
    setCurrentFieldValues(savedFieldValues);
    if (requestedMode === "edit") {
      requestMode("read");
    }
  }, [requestedMode, requestMode, savedFieldValues]);

  useEffect(() => {
    if (!instanceId) {
      return;
    }

    setIsFieldValuesReady(instance !== undefined);
    const draft = getDraft(instanceId);

    if (draft?.rawJson !== undefined) {
      setCurrentFieldValues(savedFieldValues);
      setBaseline(savedFieldValues);
      requestMode("raw");
      return;
    }

    if (draft) {
      // Drafts kept before the identifiers were editable don't change them
      setCurrentFieldValues({ [IDENTIFIER]: savedFieldValues[IDENTIFIER], ...draft.fieldValues });
      setBaseline(savedFieldValues);
      requestMode("edit");
      return;
    }

    setCurrentFieldValues(savedFieldValues);
    setBaseline(savedFieldValues);
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
    () => getChangedInstanceFieldLabels(currentFieldValues, baseline, changeLabels),
    [baseline, currentFieldValues, changeLabels],
  );

  const rawDraft = getDraft(instanceId)?.rawJson;
  const validationResults =
    !isNewInstance && instance?.validation && instance.validation.length > 0
      ? instance.validation
      : undefined;
  const hasUnsavedChanges =
    (isEditMode && changedFieldKeys.size > 0) || rawDraft !== undefined;
  const unsavedChangeLabels =
    rawDraft !== undefined ? [RAW_JSON_LABEL] : changedFieldLabels;
  const hasReverseLinks = incomingLinksLoading
    ? getDraft(instanceId)?.hasReverseLinks
    : incomingLinks.some((group) =>
        group.types.some((entry) => (entry.total ?? entry.links.length) > 0),
      );

  useEffect(() => {
    if (!instanceId || !instance || !isEditMode) {
      return;
    }

    // The form is still the empty initial values until the loaded instance, or its stored draft, is taken over.
    // Removing here would drop a draft that was restored for this session.
    if (!isFieldValuesReady) {
      return;
    }

    if (!areInstanceFieldValuesEqual(currentFieldValues, baseline)) {
      upsertDraft({
        instanceId,
        instanceName: instanceName ?? instance.instanceName,
        type: instance.type,
        fieldValues: currentFieldValues,
        baseline,
        updatedAt: Date.now(),
        isNew: isNewInstance,
        typeIdentifier: isNewInstance ? newInstanceType : undefined,
        space: isNewInstance ? newInstanceSpace : undefined,
        changedFieldLabels,
        hasReverseLinks,
      });
      return;
    }

    // An instance created for a link is kept even if nothing is filled in yet - it is linked already
    if (!newInstanceSpace) {
      removeDraft(instanceId);
    }
  }, [
    baseline,
    changedFieldLabels,
    currentFieldValues,
    instance,
    instanceId,
    hasReverseLinks,
    instanceName,
    isEditMode,
    isFieldValuesReady,
    isNewInstance,
    newInstanceSpace,
    newInstanceType,
    removeDraft,
    upsertDraft,
  ]);

  const handleLinkClick = (linkedInstanceId: string) => {
    navigate(`/editor/instances/${linkedInstanceId}${modeSearch(requestedMode)}`);
  };

  const fieldAlternatives = useFieldAlternatives(
    instance?.alternatives,
    currentFieldValues,
    setFieldValue,
  );

  if (loading) {
    return (
      <>
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" role="status" className="me-2" />
          Loading instance...
        </div>
        <UnsavedInstancesPanel
          currentInstanceId={instanceId}
          onDiscardCurrent={resetToSaved}
        />
      </>
    );
  }

  if (!instance) {
    return (
      <div>
        <h2>Instance not found</h2>
        <p>No instance found with ID: {instanceId}</p>
        {loadError && <p className="text-muted">{loadError}</p>}
        <UnsavedInstancesPanel
          currentInstanceId={instanceId}
          onDiscardCurrent={resetToSaved}
        />
      </div>
    );
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(instanceId || "");
  };

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
      hasReverseLinks,
    });
  };

  const handleRawSaved = () => {
    removeDraft(instanceId);
    reloadInstance();
  };

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
    setCurrentFieldValues(savedFieldValues);
    return true;
  };

  const switchMode = (target: InstanceMode) => {
    if (target === requestedMode || !leaveMode()) {
      return;
    }
    if (target === "edit") {
      setBaseline(savedFieldValues);
    }
    requestMode(target);
  };

  // A failure to load the comments is always shown - the fields can't tell about their comments without them
  const showInstanceComments = isInstanceCommentsOpen || comments.loadError !== undefined;
  /** The comments listed at the instance: those on the instance itself and on properties which aren't shown as fields */
  const instanceCommentCount = comments.comments.filter(
    (comment) => !comment.property || !fieldProperties.has(comment.property),
  ).length;

  const fieldComments = (field: InstanceField) =>
    canComment && !comments.loadError ? (
      <FieldComments
        key={instanceId}
        comments={comments}
        property={field.identifier}
        canModerate={canModerateComments}
        subject={field.label}
      />
    ) : null;

  const modeTitles: Record<InstanceMode, string> = {
    read: "Read",
    edit: "Edit",
    raw: canEdit ? "Show and edit the raw JSON" : "Show the raw JSON",
    release: "Release",
    info: "Information",
    review: "Review",
  };

  /** The modes that need a permission - and what the user may not do without it */
  const modePermissions: Partial<Record<InstanceMode, { permitted: boolean; action: string }>> = {
    edit: { permitted: canEdit, action: "edit this instance" },
    release: { permitted: canRelease, action: "release this instance" },
    review: { permitted: canReview, action: "invite reviewers for this instance" },
  };

  const handleSave = () => {
    // Only the changed fields are sent - the other properties of the instance are kept as they are (all the fields
    // filled in for a new instance)
    const changes = Object.fromEntries(
      [...changedFieldKeys].map((key) => [key, currentFieldValues[key] ?? null]),
    );
    setSaving(true);
    setSaveError(undefined);
    return getAccessToken()
      .then((token) =>
        isNewInstance
          ? createInstance(token, instanceId, newInstanceType, changes, newInstanceSpace)
          : updateInstance(token, instanceId, changes),
      )
      .then((stored) => {
        removeDraft(instanceId);
        setInstance(stored);
        // Stays in the edit mode with nothing unsaved - the saved values must not be kept as a draft again until they
        // are replaced by the stored ones
        setBaseline(currentFieldValues);
        if (isNewInstance) {
          setIsNewInstance(false);
          setCreatedAtLocation(location.key);
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
          navigate(`/editor/instances/${stored.instanceId}${modeSearch("edit")}`, { replace: true });
        }
      })
      .catch((e: unknown) => {
        console.error("Failed to save the instance", e);
        setSaveError(e instanceof Error ? e.message : String(e));
        throw e;
      })
      .finally(() => setSaving(false));
  };

  const confirmIncludedSave = () => {
    const currentDraft: (typeof unsavedDrafts)[number] = {
      instanceId,
      instanceName: instanceName || instance.instanceName || instanceId,
      type: instance.type,
      fieldValues: currentFieldValues,
      baseline,
      changedFieldLabels,
      updatedAt: 0,
      isNew: isNewInstance,
      typeIdentifier: isNewInstance ? newInstanceType : undefined,
      space: isNewInstance ? newInstanceSpace : instance.space,
    };
    const catalog = [
      currentDraft,
      ...unsavedDrafts.filter((draft) => draft.instanceId !== instanceId),
    ];
    const ordered = orderDraftsForSave(catalog, saveIncludedIds);
    setConfirmSave(false);
    const failures: string[] = [];
    void (async () => {
      const token = await getAccessToken();
      let parentError: string | undefined;
      for (const draft of ordered) {
        if (draft.instanceId === instanceId) {
          try {
            await handleSave();
          } catch (error) {
            parentError = error instanceof Error ? error.message : String(error);
          }
          continue;
        }
        try {
          const stored = await persistUnsavedDraft(token, draft);
          removeDraft(draft.instanceId);
          if (draft.isNew && isCreatedInstance(stored)) {
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
          }
        } catch (error) {
          failures.push(
            `${draft.instanceName}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (parentError || failures.length > 0) {
        setSaveError(
          [parentError, failures.length > 0 ? `Could not save linked instances. ${failures.join(" ")}` : undefined]
            .filter(Boolean)
            .join(" "),
        );
      }
    })();
  };

  const handleDelete = async () => {
    const token = await getAccessToken();
    await deleteInstance(token, instanceId);
    removeDraft(instanceId);
    deleteInstances([instanceId]);
    navigate("/editor");
  };

  /** Reverts the changed fields - stays in the edit mode (like the reset of the raw mode). */
  const handleReset = () => {
    removeDraft(instanceId || "");
    setSaveError(undefined);
    setCurrentFieldValues(baseline);
  };

  /** Highlights a linked instance in a field together with its representation in the outgoing links (and vice versa) when hovered. */
  const linkHoverProps = (field: InstanceField) => {
    // The instances linked by embedded instances are labeled with the nested field as well
    if (!["LINK", "LINKS", "NESTED", "SINGLE_NESTED"].includes(field.kind)) {
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

  const hasOutgoingLinks = (instance.directLinks?.length ?? 0) > 0;
  const hasIncomingLinks = incomingLinks.some((group) =>
    group.types.some((entry) => (entry.total ?? entry.links.length) > 0),
  );
  const hasLinkedRelationships = hasOutgoingLinks || hasIncomingLinks;
  const isReleasedInstance =
    instance.releaseStatus === "released" || instance.releaseStatus === "has changed";

  const getLinkStatusIcon = () => {
    const hasDirectLinks = hasOutgoingLinks;
    const hasReverseLinks = hasIncomingLinks;

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
              navigate(`/editor/instances/${item.id}${modeSearch(requestedMode)}`);
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
              <div className="instance-header-layout">
                <div className="instance-header-type-row">
                  <div className="instance-type-label">
                    <FontAwesomeIcon
                      icon={faCircle}
                      className="instance-type-color-icon me-2"
                      style={{ color: typeColor }}
                    />
                    {instance.type}
                  </div>
                  {!isNewInstance && (
                    <fieldset
                      className="instance-header-modes"
                      aria-label="Mode"
                    >
                      {INSTANCE_MODES.map(({ mode: target, icon }) => {
                        // The modes are always shown - so they do not come and go when navigating between instances
                        const missingPermission = modePermissions[target];
                        const disabled = missingPermission !== undefined && !missingPermission.permitted;
                        return (
                          <DisabledHint
                            key={target}
                            reason={disabled ? noPermission(missingPermission.action) : undefined}
                          >
                            <Button
                              variant="link"
                              className={`edit-icon-btn${mode === target ? " edit-icon-btn--active" : ""}`}
                              onClick={() => switchMode(target)}
                              disabled={disabled}
                              aria-label={modeTitles[target]}
                              aria-pressed={mode === target}
                              title={disabled ? undefined : modeTitles[target]}
                            >
                              <FontAwesomeIcon icon={icon} />
                            </Button>
                          </DisabledHint>
                        );
                      })}
                    </fieldset>
                  )}
                </div>
                <div className="instance-header-title-row">
                  <div className="instance-header-title-column">
                    <h2 className="instance-name">{instanceName}</h2>
                    <div className="instance-meta">
                      <div className="mb-1">
                        <strong>ID:</strong> {instanceId}
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 ms-2"
                          onClick={handleCopyId}
                          aria-label="Copy id"
                          title="Copy id"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </Button>
                      </div>
                      <div>
                        <strong>Space:</strong> {instance.space}
                      </div>
                    </div>
                  </div>
                  <div className="instance-header-status">
                    <img
                      src={getLinkStatusIcon()}
                      alt="Link status"
                      className="link-status-icon"
                    />
                    <InstanceStatusTags
                      releaseStatus={instance.releaseStatus}
                      contributed={instance.contributed}
                    />
                  </div>
                </div>
                <div className="instance-header-sections">
                  {validationResults && (
                    <InstanceValidationSection
                      key={instanceId}
                      validation={validationResults}
                      fieldLabels={fieldLabels}
                    />
                  )}
                  {/* Starts over with the mode - the identifiers added before are not to go unnoticed when editing.
                      Waits for the values since it decides on being expanded when mounted. */}
                  {isFieldValuesReady && (
                    <InstanceIdentifiers
                      key={`${instanceId}-${mode === "edit"}`}
                      identifiers={identifiersOf(currentFieldValues)}
                      saved={isNewInstance ? [] : savedIdentifiers}
                      isEditMode={mode === "edit"}
                      onChange={(identifiers) => setFieldValue(IDENTIFIER, identifiers)}
                    />
                  )}
                </div>
              </div>
            </div>

            {hasUnsavedChanges && (
              <div className="instance-unsaved-summary" role="status">
                <span className="instance-unsaved-summary-title">Unsaved changes</span>
                {unsavedChangeLabels.length > 0 && (
                  <ul className="instance-unsaved-summary-fields">
                    {unsavedChangeLabels.map((label, index) => (
                      <li key={`${label}-${index}`}>{label}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {mode === "review" && <InstanceReview instanceId={instanceId} onInstanceClick={handleLinkClick} />}
            {mode === "info" && <InstanceInfo instanceId={instanceId} />}
            {mode === "release" && (
              <InstanceRelease
                instanceId={instanceId}
                onInstanceClick={handleLinkClick}
              />
            )}
            {mode === "raw" && (
              <RawInstanceEditor
                instanceId={instanceId}
                canEdit={canEdit}
                draftText={rawDraft}
                onDraftChange={handleRawDraftChange}
                onSaved={handleRawSaved}
              />
            )}
            {(mode === "edit" || mode === "read") && (
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
                        {fieldComments(field)}
                        <ViewFieldLabel
                          tooltip={field.tooltip}
                          required={field.required}
                          isLabel={field.labelProperty}
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
                        {fieldComments(field)}
                        {fieldAlternatives.toggle(field)}
                        <InstanceFieldLabel
                          isChanged={changedFieldKeys.has(field.identifier)}
                          tooltip={field.tooltip}
                          required={field.required}
                          isLabel={field.labelProperty}
                          validationErrors={fieldErrors.get(field.identifier)}
                        >
                          {field.label}
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
                        {fieldAlternatives.panel(field)}
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
                        fieldAlternatives={fieldAlternatives}
                      />
                    )}

                    {saveError && (
                      <Alert variant="danger" className="mt-3 mb-0">
                        {saveError}
                      </Alert>
                    )}
                    <div className="instance-form-actions">
                      {canEdit && !isNewInstance && (
                        <Button
                          type="button"
                          variant="outline-danger"
                          className="instance-delete-trigger"
                          onClick={() => setConfirmDelete(true)}
                          disabled={saving}
                        >
                          Delete instance
                        </Button>
                      )}
                      <div
                        className={`instance-form-actions-commit${changedFieldKeys.size === 0 ? " instance-form-actions-commit--unchanged" : ""}`}
                        title={changedFieldKeys.size === 0 ? "Nothing to change" : undefined}
                      >
                        <Button
                          type="button"
                          variant="outline-secondary"
                          onClick={handleReset}
                          disabled={changedFieldKeys.size === 0 || saving}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="dark"
                          onClick={() => {
                            setSaveIncludedIds([instanceId]);
                            setConfirmSave(true);
                          }}
                          disabled={changedFieldKeys.size === 0 || saving}
                        >
                          {saving && (
                            <Spinner animation="border" size="sm" className="me-2" />
                          )}
                          Save
                        </Button>
                      </div>
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

            {canComment && !isNewInstance && (
              <div className="instance-footer-sections">
                <InstanceHeaderSection
                  key={instanceId}
                  title="Comments on this instance"
                  count={
                    instanceCommentCount > 0 && (
                      <span className="instance-header-section-count">({instanceCommentCount})</span>
                    )
                  }
                  expanded={showInstanceComments}
                  onToggle={() => setIsInstanceCommentsOpen((open) => !open)}
                  mountOnExpand
                >
                  <InstanceCommentsOverview
                    comments={comments}
                    fieldProperties={fieldProperties}
                    canModerate={canModerateComments}
                  />
                </InstanceHeaderSection>
              </div>
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
        onSaveCurrent={handleSave}
      />
      <UnsavedActionDialog
        show={confirmSave}
        action="save"
        scope="one"
        drafts={[
          {
            instanceId,
            instanceName: instanceName || instance.instanceName || instanceId,
            type: instance.type,
            fieldValues: currentFieldValues,
            baseline,
            changedFieldLabels,
            updatedAt: 0,
            isNew: isNewInstance,
            typeIdentifier: isNewInstance ? newInstanceType : undefined,
            space: isNewInstance ? newInstanceSpace : instance.space,
          },
          ...unsavedDrafts.filter((draft) => draft.instanceId !== instanceId),
        ]}
        offeredIds={[instanceId]}
        includedIds={saveIncludedIds}
        saveErrors={saveError ? { [instanceId]: saveError } : undefined}
        typeColorFor={() => typeColor}
        linkFieldLabel={(draftId, fieldKey) =>
          draftId === instanceId
            ? fields.find((field) => field.identifier === fieldKey)?.label
            : undefined
        }
        onToggle={(id) => {
          if (id === instanceId) {
            return;
          }
          setSaveIncludedIds((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
          );
        }}
        onDismiss={() => setConfirmSave(false)}
        onConfirm={confirmIncludedSave}
      />
      <DeleteInstanceModal
        show={confirmDelete && isEditMode}
        instanceName={instanceName ?? instance.instanceName}
        type={instance.type}
        typeColor={typeColor}
        instanceId={instanceId}
        released={isReleasedInstance}
        linked={hasLinkedRelationships}
        onCancel={() => setConfirmDelete(false)}
        onDelete={handleDelete}
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
  fieldAlternatives,
}: Readonly<{
  fields: InstanceField[];
  values: InstanceFieldValues;
  onChange: (identifier: string, value: unknown) => void;
  isEditMode: boolean;
  changedFieldKeys: Set<string>;
  fieldErrors: Map<string, FieldValidationError[]>;
  onInstanceClick: (instanceId: string) => void;
  /** The contributions are only offered while editing */
  fieldAlternatives?: FieldAlternativesControls;
}>) {
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
                  {fieldAlternatives?.toggle(field)}
                  <InstanceFieldLabel
                    isChanged={changedFieldKeys.has(field.identifier)}
                    tooltip={field.tooltip}
                    required={field.required}
                    validationErrors={fieldErrors.get(field.identifier)}
                  >
                    {field.label}
                  </InstanceFieldLabel>
                  {control}
                  <FieldErrors errors={fieldErrors.get(field.identifier)} />
                  {fieldAlternatives?.panel(field)}
                </Form.Group>
              ) : (
                <div key={field.identifier} {...fieldSectionProps(field)}>
                  <ViewFieldLabel
                    tooltip={field.tooltip}
                    required={field.required}
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

/** The identifiers among the values of the fields - also of a draft stored before they were edited. */
function identifiersOf(values: InstanceFieldValues): string[] {
  const identifiers = values[IDENTIFIER];
  return Array.isArray(identifiers) ? identifiers.filter((i): i is string => typeof i === "string") : [];
}

function fieldSectionProps(field: InstanceField) {
  return {
    className: "mb-4 instance-field-section",
    "data-instance-field": field.label.trim(),
  };
}

/** Marks the field the instance is named by. */
function LabelTag() {
  return (
    <span className="instance-field-label-tag" title="The instance is named by this field">
      Label
    </span>
  );
}

function RequiredMark() {
  return (
    <span className="instance-field-required text-danger" title="Required">
      <span aria-hidden="true"> *</span>
      <span className="visually-hidden"> required</span>
    </span>
  );
}

/** The label of a field in the read mode - flagged if the validation reports errors for the field. */
function ViewFieldLabel({
  children,
  tooltip,
  required = false,
  isLabel = false,
  validationErrors,
}: Readonly<{
  children: React.ReactNode;
  tooltip?: string;
  required?: boolean;
  isLabel?: boolean;
  validationErrors?: FieldValidationError[];
}>) {
  return (
    <div className="view-label" title={tooltip}>
      {children}
      {required && <RequiredMark />}
      {isLabel && <LabelTag />}
      {validationErrors && <FieldValidationIndicator errors={validationErrors} />}
    </div>
  );
}

function FieldErrors({ errors }: Readonly<{ errors?: FieldValidationError[] }>) {
  return errors ? <FieldValidationErrors errors={errors} /> : null;
}

function InstanceFieldLabel({
  children,
  isChanged = false,
  tooltip,
  required = false,
  isLabel = false,
  validationErrors,
}: Readonly<{
  children: React.ReactNode;
  isChanged?: boolean;
  tooltip?: string;
  required?: boolean;
  isLabel?: boolean;
  validationErrors?: FieldValidationError[];
}>) {
  return (
    <Form.Label
      className={`view-label${isChanged ? " instance-field-label--changed" : ""}`}
      title={tooltip}
    >
      {children}
      {required && <RequiredMark />}
      {isLabel && <LabelTag />}
      {validationErrors && <FieldValidationIndicator errors={validationErrors} />}
      {isChanged && (
        <span className="instance-field-label-changed-badge">Unsaved</span>
      )}
    </Form.Label>
  );
}

/** Confirms deletion of the open instance. Warns when links or a released copy would go with it. */
function DeleteInstanceModal({
  show,
  instanceName,
  type,
  typeColor,
  instanceId,
  released,
  linked,
  onCancel,
  onDelete,
}: Readonly<{
  show: boolean;
  instanceName: string;
  type: string;
  typeColor: string;
  instanceId: string;
  released: boolean;
  linked: boolean;
  onCancel: () => void;
  onDelete: () => Promise<void>;
}>) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (show) {
      setError(undefined);
      setDeleting(false);
    }
  }, [show]);

  const submit = () => {
    setDeleting(true);
    setError(undefined);
    onDelete()
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setDeleting(false);
      });
  };

  return (
    <Modal
      show={show}
      onHide={() => {
        if (!deleting) {
          onCancel();
        }
      }}
      centered
      animation={false}
      keyboard={!deleting}
      backdrop={deleting ? "static" : true}
      aria-labelledby="delete-instance-title"
      aria-describedby="delete-instance-description"
    >
      <Modal.Header closeButton>
        <Modal.Title id="delete-instance-title">Delete instance?</Modal.Title>
      </Modal.Header>
      <Modal.Body id="delete-instance-description">
        <p className="instance-delete-lead">
          You are about to permanently delete <strong>{instanceName}</strong>.
        </p>
        <div className="instance-delete-identity">
          <div className="instance-delete-identity-row">
            <span className="instance-delete-identity-label">Type:</span>
            <FontAwesomeIcon
              icon={faCircle}
              className="instance-type-color-icon"
              style={{ color: typeColor }}
              aria-hidden="true"
            />
            <span>{type}</span>
          </div>
          <div className="instance-delete-identity-row">
            <span className="instance-delete-identity-label">ID:</span>
            <span className="instance-delete-identity-id">{instanceId}</span>
          </div>
        </div>
        {(linked || released) && (
          <div className="instance-delete-warnings">
            {linked && (
              <p className="instance-delete-warning">
                <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
                <span>
                  Linked incoming and outgoing relationships will be removed with this instance.
                </span>
              </p>
            )}
            {released && (
              <p className="instance-delete-warning">
                <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
                <span>
                  This instance is released. Deleting it will also remove it from search.
                </span>
              </p>
            )}
          </div>
        )}
        <p className="instance-delete-irreversible">This action cannot be undone.</p>
        {error && (
          <Alert variant="danger" className="mt-3 mb-0">
            {error}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="outline-secondary" onClick={onCancel} disabled={deleting}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={submit}
          disabled={deleting}
          aria-busy={deleting}
        >
          {deleting && (
            <Spinner animation="border" size="sm" role="status" className="me-2" />
          )}
          {deleting ? "Deleting…" : "Delete instance"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
