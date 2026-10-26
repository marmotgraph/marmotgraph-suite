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

/** The outcome of the last validation of an instance against one of the validation schemas of its type. */
export type InstanceValidation = {
  name: string;
  valid: boolean;
  /** The share of the properties declared by the schema which the instance fulfills (0-100) - unknown for old results */
  compliance?: number;
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
  bookmarked: boolean;
  lastVisited?: string;
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
  const isStoredDraft =
    Boolean(instance.isDraft) &&
    (Boolean(instance.isNew) || isUnsavedInstanceId(instance.instanceId));

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

const SERVER_RACK_SPACE = "private-25ae0198-753b-497d-9163-67488442f64";

function generateLinkedInstances(
  prefix: string,
  count: number,
  type: string,
  space: string,
  startIndex = 1,
): LinkedInstance[] {
  return Array.from({ length: count }, (_, index) => {
    const number = startIndex + index;
    return {
      instanceId: `inst-mock-${prefix}-${number}`,
      instanceName: `${type.replace(" ", "-")}-${String(number).padStart(4, "0")}`,
      type,
      space,
      hasDirectLinks: false,
      hasReverseLinks: false,
    };
  });
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
    instanceId: `draft-${crypto.randomUUID()}`,
    instanceName,
    type,
    space,
    isDraft: true,
    isNew: true,
    hasDirectLinks: false,
    hasReverseLinks: false,
  }));
}

function instanceToLinkedInstance(instance: InstanceSummary): LinkedInstance {
  return {
    instanceId: instance.instanceId,
    instanceName: instance.instanceName,
    type: instance.type,
    space: instance.space,
    hasDirectLinks: Boolean(instance.directLinks?.length),
    hasReverseLinks: Boolean(instance.reverseLinks?.length),
  };
}

function dedupeLinkedInstances(instances: LinkedInstance[]): LinkedInstance[] {
  const seen = new Map<string, LinkedInstance>();

  for (const instance of instances) {
    seen.set(instance.instanceId, instance);
  }

  return [...seen.values()];
}

let selectableInstanceCatalog: LinkedInstance[] | null = null;

export function getSelectableInstanceCatalog(): LinkedInstance[] {
  if (!selectableInstanceCatalog) {
    selectableInstanceCatalog = dedupeLinkedInstances([
      ...mockInstances.map(instanceToLinkedInstance),
      ...generateLinkedInstances("blade", 480, "Blade", SERVER_RACK_SPACE, 3),
      ...generateLinkedInstances(
        "cabinet",
        50,
        "Cabinet",
        "team-infrastructure-ops",
      ),
      ...generateLinkedInstances("asset", 20, "Asset Tag", SERVER_RACK_SPACE),
    ]);
  }

  return selectableInstanceCatalog;
}

/** The instances which can be linked by a field - restricted to the allowed types (if there are any). */
export function getSelectableInstancesForField(
  allowedTypes: string[],
  excludeInstanceId?: string,
): LinkedInstance[] {
  return getSelectableInstanceCatalog().filter(
    (instance) =>
      (allowedTypes.length === 0 || allowedTypes.includes(instance.type)) &&
      instance.instanceId !== excludeInstanceId,
  );
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

export function isUnsavedInstanceId(instanceId: string): boolean {
  return instanceId.startsWith("new-") || instanceId.startsWith("draft-");
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

  if (isUnsavedInstanceId(instance.instanceId)) {
    return {
      isDraft: true,
      isNew: instance.instanceId.startsWith("new-"),
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

export const mockInstances: InstanceSummary[] = [
  {
    id: 1,
    instanceId: "inst-47b94e45-5435-49a8-aba3-3d482fabced3",
    type: "Appliance",
    instanceName: "Server-Rack-A1",
    space: "private-25ae0198-753b-497d-9163-67488442f64",
    permissions: "View, Edit, Review, Release",
    bookmarked: true,
    lastVisited: "2026-04-18",
    releaseStatus: "released",
    directLinks: [
      {
        instanceId: "inst-b2c3d4e5-f6a7-4b5c-8d9e-0f1a2b3c4d5e",
        instanceName: "Compute-Blade-12",
        type: "Blade",
        space: "team-compute-ops",
        fieldLabel: "Field 3",
        hasDirectLinks: true,
        hasReverseLinks: false,
      },
      {
        instanceId: "inst-a7b8c9d0-e1f2-4a5b-3c4d-5e6f7a8b9c0d",
        instanceName: "GPU-Blade-Tesla-8",
        type: "Blade",
        space: "private-25ae0198-753b-497d-9163-67488442f64",
        fieldLabel: "Field 3",
        hasDirectLinks: false,
        hasReverseLinks: true,
      },
      {
        instanceId: "inst-c3d4e5f6-a7b8-4c5d-9e0f-1a2b3c4d5e6f",
        instanceName: "Asset-2023-1547",
        type: "Asset Tag",
        space: "private-25ae0198-753b-497d-9163-67488442f64",
        fieldLabel: "Field 5",
        hasDirectLinks: false,
        hasReverseLinks: false,
      },
    ],
    reverseLinks: [
      {
        instanceId: "inst-a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
        instanceName: "Data Center North",
        type: "Building",
        space: "shared-infrastructure-workspace",
        fieldLabel: "Server Racks",
        hasDirectLinks: true,
        hasReverseLinks: true,
      },
    ],
  },
  {
    id: 2,
    instanceId: "inst-a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
    type: "Building",
    instanceName: "Data Center North",
    space: "shared-infrastructure-workspace",
    permissions: "View",
    bookmarked: false,
    releaseStatus: "in progress",
  },
  {
    id: 3,
    instanceId: "inst-302a3695-722c-4e29-9543-8f6a7b8c9d0e",
    type: "Cabinet",
    instanceName: "Storage-Cabinet-B3",
    space: "private-302a3695-722c-4e29-9543-8f6a",
    permissions: "View, Edit, Review",
    bookmarked: true,
    lastVisited: "2026-04-20",
    releaseStatus: "released",
  },
  {
    id: 4,
    instanceId: "inst-b2c3d4e5-f6a7-4b5c-8d9e-0f1a2b3c4d5e",
    type: "Blade",
    instanceName: "Compute-Blade-12",
    space: "team-compute-ops",
    permissions: "View, Edit, Release",
    bookmarked: false,
    releaseStatus: "released",
    directLinks: [
      {
        instanceId: "inst-302a3695-722c-4e29-9543-8f6a7b8c9d0e",
        instanceName: "Storage-Cabinet-B3",
        type: "Cabinet",
        space: "private-302a3695-722c-4e29-9543-8f6a",
        fieldLabel: "Storage Unit",
        hasDirectLinks: true,
        hasReverseLinks: true,
      },
    ],
    reverseLinks: [
      {
        instanceId: "inst-47b94e45-5435-49a8-aba3-3d482fabced3",
        instanceName: "Server-Rack-A1",
        type: "Appliance",
        space: "private-25ae0198-753b-497d-9163-67488442f64",
        fieldLabel: "Compute Resources",
        hasDirectLinks: true,
        hasReverseLinks: true,
      },
    ],
  },
  {
    id: 5,
    instanceId: "inst-c3d4e5f6-a7b8-4c5d-9e0f-1a2b3c4d5e6f",
    type: "Asset Tag",
    instanceName: "Asset-2023-1547",
    space: "private-25ae0198-753b-497d-9163-67488442f64",
    permissions: "View",
    bookmarked: true,
    lastVisited: "2026-04-15",
    releaseStatus: "in progress",
  },
  {
    id: 6,
    instanceId: "inst-d4e5f6a7-b8c9-4d5e-0f1a-2b3c4d5e6f7a",
    type: "Building",
    instanceName: "Office Complex Alpha",
    space: "shared-facilities-workspace",
    permissions: "View, Review",
    bookmarked: false,
    releaseStatus: "released",
  },
  {
    id: 7,
    instanceId: "inst-7f8e9d0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
    type: "Appliance",
    instanceName: "Network-Switch-Core-1",
    space: "private-7f8e9d0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
    permissions: "View, Edit",
    bookmarked: true,
    lastVisited: "2026-04-21",
    releaseStatus: "in progress",
  },
  {
    id: 8,
    instanceId: "inst-e5f6a7b8-c9d0-4e5f-1a2b-3c4d5e6f7a8b",
    type: "Cabinet",
    instanceName: "Server-Cabinet-C5",
    space: "team-infrastructure-ops",
    permissions: "View",
    bookmarked: false,
    releaseStatus: "released",
  },
  {
    id: 9,
    instanceId: "inst-f6a7b8c9-d0e1-4f5a-2b3c-4d5e6f7a8b9c",
    type: "Canton",
    instanceName: "Zurich-Site-Main",
    space: "shared-location-workspace",
    permissions: "View, Edit, Share",
    bookmarked: true,
    releaseStatus: "released",
  },
  {
    id: 10,
    instanceId: "inst-a7b8c9d0-e1f2-4a5b-3c4d-5e6f7a8b9c0d",
    type: "Blade",
    instanceName: "GPU-Blade-Tesla-8",
    space: "private-25ae0198-753b-497d-9163-67488442f64",
    permissions: "View, Edit",
    bookmarked: false,
    lastVisited: "2026-04-19",
    releaseStatus: "in progress",
    reverseLinks: [
      {
        instanceId: "inst-47b94e45-5435-49a8-aba3-3d482fabced3",
        instanceName: "Server-Rack-A1",
        type: "Appliance",
        space: "private-25ae0198-753b-497d-9163-67488442f64",
        fieldLabel: "GPU Resources",
        hasDirectLinks: true,
        hasReverseLinks: true,
      },
    ],
  },
];
