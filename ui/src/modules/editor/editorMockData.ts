export type LinkedInstance = {
  instanceId: string;
  instanceName: string;
  type: string;
  space: string;
  fieldLabel?: string;
  hasDirectLinks?: boolean;
  hasReverseLinks?: boolean;
  /** Instance is not yet persisted or has unsaved edits. */
  isDraft?: boolean;
  /** Brand-new instance that has never been saved. */
  isNew?: boolean;
};

export type Instance = {
  id: number;
  instanceId: string;
  type: string;
  instanceName: string;
  space: string;
  permissions: string;
  bookmarked: boolean;
  lastVisited?: string;
  releaseStatus: "released" | "in progress";
  directLinks?: LinkedInstance[];
  reverseLinks?: LinkedInstance[];
};

export type InstanceFieldValues = {
  field1: string;
  field2: string;
  field3: LinkedInstance[];
  field4: LinkedInstance[];
  field5: LinkedInstance[];
};

export const emptyInstanceFieldValues: InstanceFieldValues = {
  field1: "",
  field2: "",
  field3: [],
  field4: [],
  field5: [],
};

export function areInstanceFieldValuesEqual(
  left: InstanceFieldValues,
  right: InstanceFieldValues,
): boolean {
  return getChangedInstanceFieldKeys(left, right).length === 0;
}

const INSTANCE_FIELD_KEYS: Array<keyof InstanceFieldValues> = [
  "field1",
  "field2",
  "field3",
  "field4",
  "field5",
];

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

function isInstanceFieldValueEqual(
  key: keyof InstanceFieldValues,
  left: InstanceFieldValues,
  right: InstanceFieldValues,
): boolean {
  if (key === "field1" || key === "field2") {
    return left[key] === right[key];
  }

  return areLinkedInstanceListsEqual(left[key], right[key]);
}

export function getChangedInstanceFieldKeys(
  current: InstanceFieldValues,
  baseline: InstanceFieldValues,
): Array<keyof InstanceFieldValues> {
  return INSTANCE_FIELD_KEYS.filter(
    (key) => !isInstanceFieldValueEqual(key, current, baseline),
  );
}

const SERVER_RACK_A1_ID = "inst-47b94e45-5435-49a8-aba3-3d482fabced3";
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

const serverRackField3Links: LinkedInstance[] = [
  {
    instanceId: "draft-blade-001",
    instanceName: "New-Blade-001",
    type: "Blade",
    space: SERVER_RACK_SPACE,
    hasDirectLinks: false,
    hasReverseLinks: false,
    isDraft: true,
    isNew: true,
  },
  {
    instanceId: "draft-cabinet-002",
    instanceName: "Staging-Cabinet-02",
    type: "Cabinet",
    space: "team-infrastructure-ops",
    hasDirectLinks: false,
    hasReverseLinks: false,
    isDraft: true,
  },
  {
    instanceId: "inst-b2c3d4e5-f6a7-4b5c-8d9e-0f1a2b3c4d5e",
    instanceName: "Compute-Blade-12",
    type: "Blade",
    space: "team-compute-ops",
    hasDirectLinks: true,
    hasReverseLinks: false,
  },
  {
    instanceId: "inst-a7b8c9d0-e1f2-4a5b-3c4d-5e6f7a8b9c0d",
    instanceName: "GPU-Blade-Tesla-8",
    type: "Blade",
    space: SERVER_RACK_SPACE,
    hasDirectLinks: false,
    hasReverseLinks: true,
  },
  ...generateLinkedInstances("blade", 480, "Blade", SERVER_RACK_SPACE, 3),
  ...generateLinkedInstances("cabinet", 50, "Cabinet", "team-infrastructure-ops"),
];

function createSimpleLinkedInstance(
  name: string,
  index: number,
  type = "Appliance",
): LinkedInstance {
  return {
    instanceId: `inst-default-field-${index}`,
    instanceName: name,
    type,
    space: "default-space",
    hasDirectLinks: false,
    hasReverseLinks: false,
  };
}

const defaultFieldValues: InstanceFieldValues = {
  field1: "Field value",
  field2: "Field value",
  field3: [
    createSimpleLinkedInstance("Field value 1", 1),
    createSimpleLinkedInstance("Field value 2", 2),
    createSimpleLinkedInstance("Field value 3", 3),
    createSimpleLinkedInstance("Field value 4", 4),
  ],
  field4: [createSimpleLinkedInstance("Field value 1", 5)],
  field5: [
    createSimpleLinkedInstance("Field value 1", 6),
    createSimpleLinkedInstance("Field value 2", 7),
    createSimpleLinkedInstance("Field value 3", 8),
    createSimpleLinkedInstance("Field value 4", 9),
  ],
};

const instanceFieldValues: Record<string, InstanceFieldValues> = {
  [SERVER_RACK_A1_ID]: {
    field1: "Rack Unit 42",
    field2: "Primary compute enclosure",
    field3: serverRackField3Links,
    field4: [
      {
        instanceId: "inst-c3d4e5f6-a7b8-4c5d-9e0f-1a2b3c4d5e6f",
        instanceName: "Asset-2023-1547",
        type: "Asset Tag",
        space: SERVER_RACK_SPACE,
        hasDirectLinks: false,
        hasReverseLinks: false,
      },
    ],
    field5: [
      {
        instanceId: "inst-c3d4e5f6-a7b8-4c5d-9e0f-1a2b3c4d5e6f",
        instanceName: "Asset-2023-1547",
        type: "Asset Tag",
        space: SERVER_RACK_SPACE,
        hasDirectLinks: false,
        hasReverseLinks: false,
      },
    ],
  },
};

export function getInstanceFieldValues(
  instanceId: string,
): InstanceFieldValues {
  return instanceFieldValues[instanceId] ?? defaultFieldValues;
}

export type InstanceLinkedFieldKey = "field3" | "field4" | "field5";

export const instanceLinkedFieldConfig: Record<
  InstanceLinkedFieldKey,
  { label: string; allowedTypes: string[] }
> = {
  field3: { label: "Field 3", allowedTypes: ["Blade", "Cabinet"] },
  field4: { label: "Field 4", allowedTypes: ["Asset Tag"] },
  field5: { label: "Field 5", allowedTypes: ["Asset Tag"] },
};

export function getInstanceFieldLabel(key: keyof InstanceFieldValues): string {
  if (key === "field3") {
    return instanceLinkedFieldConfig.field3.label;
  }

  if (key === "field4") {
    return instanceLinkedFieldConfig.field4.label;
  }

  if (key === "field5") {
    return instanceLinkedFieldConfig.field5.label;
  }

  return key === "field1" ? "Field 1" : "Field 2";
}

export function getChangedInstanceFieldLabels(
  current: InstanceFieldValues,
  baseline: InstanceFieldValues,
): string[] {
  return getChangedInstanceFieldKeys(current, baseline).map(getInstanceFieldLabel);
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

export function normalizeInstanceFieldValues(
  values: InstanceFieldValues,
): InstanceFieldValues {
  return {
    field1: values.field1,
    field2: values.field2,
    field3: normalizeLinkedInstancesForField(values.field3),
    field4: normalizeLinkedInstancesForField(values.field4),
    field5: normalizeLinkedInstancesForField(values.field5),
  };
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

function instanceToLinkedInstance(instance: Instance): LinkedInstance {
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

export function getSelectableInstancesForField(
  fieldKey: InstanceLinkedFieldKey,
  excludeInstanceId?: string,
): LinkedInstance[] {
  const { allowedTypes } = instanceLinkedFieldConfig[fieldKey];

  return getSelectableInstanceCatalog().filter(
    (instance) =>
      allowedTypes.includes(instance.type) &&
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

export const mockInstances: Instance[] = [
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
