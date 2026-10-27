export type LinkedInstance = {
  instanceId: string;
  instanceName: string;
  type: string;
  typeColor?: string;
  space: string;
  fieldLabel?: string;
  /** Whether the linked instance has outgoing links itself (unknown if it is not readable) */
  hasDirectLinks?: boolean;
  /** Whether the linked instance has incoming links itself (unknown if it is not readable) */
  hasReverseLinks?: boolean;
  /** Instance is not yet persisted or has unsaved edits. */
  isDraft?: boolean;
  /** Brand-new instance that has never been saved. */
  isNew?: boolean;
  /**
   * Whether the link could be resolved by the backend (resolved if absent): a restricted target exists but is not
   * readable by the user (only its id and type are known), an unresolved one doesn't point to any known instance (the
   * instanceId then holds the identifier the instance is linked with).
   */
  linkStatus?: LinkStatus;
};

export type LinkStatus = "resolved" | "restricted" | "unresolved";

/** Only resolved links can be opened - the target of the others is either not readable or not known. */
export function isResolvedLink(instance: Pick<LinkedInstance, "linkStatus">) {
  return !instance.linkStatus || instance.linkStatus === "resolved";
}

/** The name shown for a linked instance - the label of the target is only available for resolved links. */
export function linkedInstanceDisplayName(
  instance: Pick<LinkedInstance, "linkStatus" | "instanceName">,
) {
  switch (instance.linkStatus) {
    case "restricted":
      return "Restricted instance";
    case "unresolved":
      return "Unknown connection";
    default:
      return instance.instanceName;
  }
}

/** Explains why a linked instance which is not resolved can not be opened. */
export function linkedInstanceStatusDescription(
  instance: Pick<LinkedInstance, "linkStatus" | "instanceId">,
) {
  switch (instance.linkStatus) {
    case "restricted":
      return `You don't have access to this instance (${instance.instanceId})`;
    case "unresolved":
      return `No instance is known for the identifier ${instance.instanceId}`;
    default:
      return undefined;
  }
}

/** A violation reported by a validation schema - field is the identifier of the field it concerns (if any). */
export type InstanceValidationError = {
  field?: string;
  keyword?: string;
  message: string;
};

/** The outcome of the last validation of an instance against one of the validation schemas of its type. */
export type InstanceValidation = {
  name: string;
  valid: boolean;
  /** The share of the properties declared by the schema which the instance fulfills (0-100) - unknown for old results */
  compliance?: number;
  /** The violations - only provided for the detail of an instance */
  errors?: InstanceValidationError[];
};

/** "has changed": released, but modified since the release. */
export type ReleaseStatus = "released" | "has changed" | "in progress";

export type InstanceSummary = {
  id: number;
  instanceId: string;
  type: string;
  typeDescription?: string;
  typeColor?: string;
  instanceName: string;
  space: string;
  permissions: string;
  /** Whether the user has flagged the instance as favorite */
  favorite: boolean;
  /** Whether the user has contributed to the instance */
  contributed: boolean;
  /** The last update of the instance (ISO timestamp) */
  lastModified?: string;
  releaseStatus: ReleaseStatus;
  /** The results of the last validation per validation schema of the type */
  validation?: InstanceValidation[];
  directLinks?: LinkedInstance[];
  reverseLinks?: LinkedInstance[];
};

/** The values of the fields of an instance by the identifier of the field - in the shape required by the kind of the field. */
export type InstanceFieldValues = Record<string, unknown>;

export const emptyInstanceFieldValues: InstanceFieldValues = {};

export function areInstanceFieldValuesEqual(
  left: InstanceFieldValues,
  right: InstanceFieldValues,
): boolean {
  return getChangedInstanceFieldKeys(left, right).length === 0;
}

function getStoredDraftMetadata(instance: LinkedInstance): {
  isDraft: boolean;
  isNew: boolean;
} {
  const isStoredDraft = Boolean(instance.isDraft) && Boolean(instance.isNew);

  return {
    isDraft: isStoredDraft,
    isNew: isStoredDraft && Boolean(instance.isNew),
  };
}

function areLinkedInstanceListsEqual(
  left: LinkedInstance[],
  right: LinkedInstance[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((instance, index) => {
    const other = right[index];

    if (instance.instanceId !== other.instanceId) {
      return false;
    }

    const leftDraft = getStoredDraftMetadata(instance);
    const rightDraft = getStoredDraftMetadata(other);

    return (
      leftDraft.isDraft === rightDraft.isDraft &&
      leftDraft.isNew === rightDraft.isNew
    );
  });
}

function isLinkedInstance(value: unknown): value is LinkedInstance {
  return typeof value === "object" && value !== null && "instanceId" in value;
}

/** Empty values (no value, an empty text) are considered equal. */
function normalizeFieldValue(value: unknown): unknown {
  return value === undefined || value === "" ? null : value;
}

function isInstanceFieldValueEqual(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizeFieldValue(left);
  const normalizedRight = normalizeFieldValue(right);

  if (
    Array.isArray(normalizedLeft) &&
    Array.isArray(normalizedRight) &&
    normalizedLeft.every(isLinkedInstance) &&
    normalizedRight.every(isLinkedInstance)
  ) {
    return areLinkedInstanceListsEqual(normalizedLeft, normalizedRight);
  }

  if (isLinkedInstance(normalizedLeft) && isLinkedInstance(normalizedRight)) {
    return areLinkedInstanceListsEqual([normalizedLeft], [normalizedRight]);
  }

  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

export function getChangedInstanceFieldKeys(
  current: InstanceFieldValues,
  baseline: InstanceFieldValues,
): string[] {
  return [...new Set([...Object.keys(current), ...Object.keys(baseline)])].filter(
    (key) => !isInstanceFieldValueEqual(current[key], baseline[key]),
  );
}

export function getChangedInstanceFieldLabels(
  current: InstanceFieldValues,
  baseline: InstanceFieldValues,
  fields: Array<{ identifier: string; label: string }>,
): string[] {
  const labels = new Map(fields.map((field) => [field.identifier, field.label]));

  return getChangedInstanceFieldKeys(current, baseline).map(
    (key) => labels.get(key) ?? key,
  );
}

export function normalizeLinkedInstanceForStorage(
  instance: LinkedInstance,
): LinkedInstance {
  const normalized: LinkedInstance = {
    instanceId: instance.instanceId,
    instanceName: instance.instanceName,
    type: instance.type,
    space: instance.space,
  };
  const draftMetadata = getStoredDraftMetadata(instance);

  if (draftMetadata.isDraft) {
    normalized.isDraft = true;

    if (draftMetadata.isNew) {
      normalized.isNew = true;
    }
  }

  return normalized;
}

export function normalizeLinkedInstancesForField(
  instances: LinkedInstance[],
): LinkedInstance[] {
  return instances.map(normalizeLinkedInstanceForStorage);
}

export function buildBulkInstanceNames(
  prefix: string,
  quantity: number,
): string[] {
  const trimmed = prefix.trim();

  if (!trimmed || quantity < 1) {
    return [];
  }

  if (quantity === 1) {
    return [trimmed];
  }

  const padWidth = Math.max(3, String(quantity).length);

  return Array.from({ length: quantity }, (_, index) =>
    `${trimmed}-${String(index + 1).padStart(padWidth, "0")}`,
  );
}

export function createDraftLinkedInstances(
  type: string,
  names: string[],
  space: string,
): LinkedInstance[] {
  return names.map((instanceName) => ({
    instanceId: crypto.randomUUID(),
    instanceName,
    type,
    space,
    isDraft: true,
    isNew: true,
    hasDirectLinks: false,
    hasReverseLinks: false,
  }));
}

export function idsToLinkedInstances(
  ids: string[],
  catalog: LinkedInstance[],
): LinkedInstance[] {
  const catalogMap = new Map(
    catalog.map((instance) => [instance.instanceId, instance]),
  );

  return ids
    .map((id) => catalogMap.get(id))
    .filter((instance): instance is LinkedInstance => Boolean(instance));
}

type LinkedInstanceDraftSource = Pick<LinkedInstance, "isDraft" | "isNew"> & {
  instanceId: string;
};

export function resolveLinkedInstanceDraftFlags(
  instance: LinkedInstanceDraftSource,
  unsavedDraft?: Pick<LinkedInstance, "isNew">,
): Pick<LinkedInstance, "isDraft" | "isNew"> | null {
  if (instance.isDraft || instance.isNew) {
    return {
      isDraft: true,
      isNew: Boolean(instance.isNew),
    };
  }

  if (unsavedDraft) {
    return {
      isDraft: true,
      isNew: Boolean(unsavedDraft.isNew),
    };
  }

  return null;
}

export function enrichLinkedInstancesWithDrafts<
  T extends LinkedInstanceDraftSource,
>(
  instances: T[],
  getUnsavedDraft?: (
    instanceId: string,
  ) => Pick<LinkedInstance, "isNew"> | undefined,
): T[] {
  return instances.map((instance) => {
    const draftFlags = resolveLinkedInstanceDraftFlags(
      instance,
      getUnsavedDraft?.(instance.instanceId),
    );

    if (!draftFlags) {
      return instance;
    }

    return {
      ...instance,
      ...draftFlags,
    };
  });
}

export function isLinkedInstanceDraft(instance: LinkedInstance): boolean {
  return Boolean(
    resolveLinkedInstanceDraftFlags(instance)?.isDraft,
  );
}
