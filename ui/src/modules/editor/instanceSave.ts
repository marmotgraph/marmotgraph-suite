import {
  getInstanceFieldLabel,
  getLinkedInstanceIdsFromFieldValues,
  Instance,
  InstanceFieldValues,
  isMandatoryInstanceField,
  isUnsavedInstanceId,
  LinkedInstance,
  normalizeInstanceFieldValues,
  normalizeLinkedInstanceForStorage,
} from "./editorMockData";
import { UnsavedInstanceDraft } from "../../contexts/UnsavedInstancesContext";

export type SaveValidationIssue = {
  instanceId: string;
  instanceName: string;
  missingFields: string[];
};

export type SavePlanItem = {
  instanceId: string;
  instanceName: string;
  type: string;
  isNew: boolean;
  changedFieldLabels?: string[];
  requiredBy?: string;
};

export type SavePlan = {
  rootIds: string[];
  orderedIds: string[];
  items: SavePlanItem[];
  validationIssues: SaveValidationIssue[];
  requiresConfirmation: boolean;
};

export type SaveExecutionResult = {
  savedIds: string[];
  idMappings: Record<string, string>;
};

type DraftLookup = (instanceId: string) => UnsavedInstanceDraft | undefined;

function isDraftLinkTarget(
  instanceId: string,
  getDraft: DraftLookup,
): boolean {
  if (isUnsavedInstanceId(instanceId)) {
    return true;
  }

  return Boolean(getDraft(instanceId));
}

function getDraftDependencies(
  draft: UnsavedInstanceDraft,
  getDraft: DraftLookup,
): string[] {
  const dependencies = new Set<string>();

  for (const linkedInstanceId of getLinkedInstanceIdsFromFieldValues(
    draft.fieldValues,
  )) {
    if (linkedInstanceId === draft.instanceId) {
      continue;
    }

    if (isDraftLinkTarget(linkedInstanceId, getDraft)) {
      dependencies.add(linkedInstanceId);
    }
  }

  return [...dependencies];
}

export function collectSaveClosure(
  rootIds: string[],
  getDraft: DraftLookup,
): string[] {
  const closure = new Set<string>();
  const queue = [...rootIds];

  while (queue.length > 0) {
    const instanceId = queue.shift();

    if (!instanceId || closure.has(instanceId)) {
      continue;
    }

    const draft = getDraft(instanceId);

    if (!draft) {
      continue;
    }

    closure.add(instanceId);

    for (const dependencyId of getDraftDependencies(draft, getDraft)) {
      if (!closure.has(dependencyId)) {
        queue.push(dependencyId);
      }
    }
  }

  return [...closure];
}

export function getTopologicalSaveOrder(
  instanceIds: string[],
  getDraft: DraftLookup,
): string[] {
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const instanceId of instanceIds) {
    dependencies.set(instanceId, new Set());
    dependents.set(instanceId, new Set());
  }

  for (const instanceId of instanceIds) {
    const draft = getDraft(instanceId);

    if (!draft) {
      continue;
    }

    for (const dependencyId of getDraftDependencies(draft, getDraft)) {
      if (!instanceIds.includes(dependencyId)) {
        continue;
      }

      dependencies.get(instanceId)?.add(dependencyId);
      dependents.get(dependencyId)?.add(instanceId);
    }
  }

  const inDegree = new Map(
    instanceIds.map((instanceId) => [
      instanceId,
      dependencies.get(instanceId)?.size ?? 0,
    ]),
  );
  const queue = instanceIds.filter(
    (instanceId) => (inDegree.get(instanceId) ?? 0) === 0,
  );
  const ordered: string[] = [];

  while (queue.length > 0) {
    const instanceId = queue.shift();

    if (!instanceId) {
      continue;
    }

    ordered.push(instanceId);

    for (const dependentId of dependents.get(instanceId) ?? []) {
      const nextDegree = (inDegree.get(dependentId) ?? 0) - 1;
      inDegree.set(dependentId, nextDegree);

      if (nextDegree === 0) {
        queue.push(dependentId);
      }
    }
  }

  if (ordered.length !== instanceIds.length) {
    return [
      ...ordered,
      ...instanceIds.filter((instanceId) => !ordered.includes(instanceId)),
    ];
  }

  return ordered;
}

export function validateDraftForSave(
  draft: UnsavedInstanceDraft,
): SaveValidationIssue | null {
  const missingFields: string[] = [];

  for (const fieldKey of Object.keys(draft.fieldValues) as Array<
    keyof InstanceFieldValues
  >) {
    if (!isMandatoryInstanceField(fieldKey)) {
      continue;
    }

    const value = draft.fieldValues[fieldKey];

    if (typeof value === "string" && value.trim().length === 0) {
      missingFields.push(getInstanceFieldLabel(fieldKey));
    }
  }

  if (missingFields.length === 0) {
    return null;
  }

  return {
    instanceId: draft.instanceId,
    instanceName: draft.instanceName,
    missingFields,
  };
}

export function validateDraftsForSave(
  instanceIds: string[],
  getDraft: DraftLookup,
): SaveValidationIssue[] {
  return instanceIds
    .map((instanceId) => getDraft(instanceId))
    .filter((draft): draft is UnsavedInstanceDraft => Boolean(draft))
    .map(validateDraftForSave)
    .filter((issue): issue is SaveValidationIssue => Boolean(issue));
}

function findRequiredBy(
  targetId: string,
  rootIds: string[],
  getDraft: DraftLookup,
): string | undefined {
  for (const rootId of rootIds) {
    const draft = getDraft(rootId);

    if (!draft) {
      continue;
    }

    if (
      getLinkedInstanceIdsFromFieldValues(draft.fieldValues).includes(targetId)
    ) {
      return draft.instanceName;
    }
  }

  return undefined;
}

export function buildSavePlan(
  rootIds: string[],
  getDraft: DraftLookup,
): SavePlan {
  const uniqueRootIds = [...new Set(rootIds)];
  const closure = collectSaveClosure(uniqueRootIds, getDraft);
  const orderedIds = getTopologicalSaveOrder(closure, getDraft);
  const validationIssues = validateDraftsForSave(closure, getDraft);
  const items: SavePlanItem[] = closure.map((instanceId) => {
    const draft = getDraft(instanceId);

    return {
      instanceId,
      instanceName: draft?.instanceName ?? instanceId,
      type: draft?.type ?? "Instance",
      isNew: Boolean(draft?.isNew || isUnsavedInstanceId(instanceId)),
      changedFieldLabels: draft?.changedFieldLabels,
      requiredBy: uniqueRootIds.includes(instanceId)
        ? undefined
        : findRequiredBy(instanceId, uniqueRootIds, getDraft),
    };
  });

  return {
    rootIds: uniqueRootIds,
    orderedIds,
    items,
    validationIssues,
    requiresConfirmation:
      closure.length > 1 || validationIssues.length > 0,
  };
}

function remapLinkedInstance(
  linkedInstance: LinkedInstance,
  idMappings: Record<string, string>,
): LinkedInstance {
  const mappedId =
    idMappings[linkedInstance.instanceId] ?? linkedInstance.instanceId;

  return normalizeLinkedInstanceForStorage({
    ...linkedInstance,
    instanceId: mappedId,
  });
}

function normalizeLinkedInstanceAfterSave(
  linkedInstance: LinkedInstance,
): LinkedInstance {
  return normalizeLinkedInstanceForStorage(linkedInstance);
}

export function remapFieldValues(
  fieldValues: InstanceFieldValues,
  idMappings: Record<string, string>,
): InstanceFieldValues {
  return {
    field1: fieldValues.field1,
    field2: fieldValues.field2,
    field3: fieldValues.field3.map((linkedInstance) =>
      remapLinkedInstance(linkedInstance, idMappings),
    ),
    field4: fieldValues.field4.map((linkedInstance) =>
      remapLinkedInstance(linkedInstance, idMappings),
    ),
    field5: fieldValues.field5.map((linkedInstance) =>
      remapLinkedInstance(linkedInstance, idMappings),
    ),
  };
}

type ExecuteSaveOptions = {
  instanceIds: string[];
  getDraft: DraftLookup;
  getInstance: (instanceId: string) => Instance | undefined;
  instances: Instance[];
  addInstance: (instance: Instance) => void;
  updateInstance: (instanceId: string, updates: Partial<Instance>) => void;
  setInstanceFieldValues: (
    instanceId: string,
    values: InstanceFieldValues,
  ) => void;
  removeDraft: (instanceId: string) => void;
};

export function executeSavePlan(
  options: ExecuteSaveOptions,
): SaveExecutionResult {
  const {
    instanceIds,
    getDraft,
    getInstance,
    instances,
    addInstance,
    updateInstance,
    setInstanceFieldValues,
    removeDraft,
  } = options;
  const closure = collectSaveClosure(instanceIds, getDraft);
  const orderedIds = getTopologicalSaveOrder(closure, getDraft);
  const validationIssues = validateDraftsForSave(closure, getDraft);

  if (validationIssues.length > 0) {
    throw new Error("Save plan contains validation errors.");
  }

  const idMappings: Record<string, string> = {};
  const savedIds: string[] = [];

  for (const instanceId of orderedIds) {
    const draft = getDraft(instanceId);

    if (!draft) {
      continue;
    }

    const remappedFieldValues = remapFieldValues(draft.fieldValues, idMappings);
    let persistedId = instanceId;

    if (draft.isNew || isUnsavedInstanceId(instanceId)) {
      persistedId = `inst-${crypto.randomUUID()}`;
      idMappings[instanceId] = persistedId;

      const existing = getInstance(instanceId);
      addInstance({
        id: instances.length + savedIds.length + 1,
        instanceId: persistedId,
        type: draft.type,
        instanceName: draft.instanceName,
        space:
          draft.space ??
          existing?.space ??
          remappedFieldValues.field3[0]?.space ??
          "default-space",
        permissions: existing?.permissions ?? "View, Edit",
        bookmarked: existing?.bookmarked ?? false,
        releaseStatus: existing?.releaseStatus ?? "in progress",
        directLinks: existing?.directLinks ?? [],
        reverseLinks: existing?.reverseLinks ?? [],
      });
    } else {
      updateInstance(instanceId, {
        instanceName: draft.instanceName,
        type: draft.type,
      });
    }

    setInstanceFieldValues(persistedId, remappedFieldValues);
    removeDraft(instanceId);
    savedIds.push(persistedId);
  }

  return { savedIds, idMappings };
}
