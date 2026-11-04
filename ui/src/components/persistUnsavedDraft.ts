import { UnsavedInstanceDraft } from "../contexts/UnsavedInstancesContext";
import { getChangedInstanceFieldKeys } from "../modules/editor/editorMockData";
import {
  createInstance,
  InstanceDetail,
  RawInstance,
  replaceRawInstance,
  updateInstance,
} from "../services/instances";

function changedFields(draft: UnsavedInstanceDraft): Record<string, unknown> {
  const baseline = draft.baseline ?? {};
  const keys = draft.baseline
    ? getChangedInstanceFieldKeys(draft.fieldValues, baseline)
    : Object.keys(draft.fieldValues);
  return Object.fromEntries(keys.map((key) => [key, draft.fieldValues[key] ?? null]));
}

function parseRawInstance(rawJson: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("The instance needs to be a valid JSON object.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("The instance needs to be a valid JSON object.");
  }
  return parsed as Record<string, unknown>;
}

export function isCreatedInstance(
  value: InstanceDetail | RawInstance,
): value is InstanceDetail {
  return (
    typeof value.instanceId === "string" &&
    typeof value.type === "string" &&
    typeof value.instanceName === "string" &&
    typeof value.space === "string" &&
    typeof value.permissions === "string" &&
    typeof value.releaseStatus === "string"
  );
}

/** Writes one draft. A new instance is created; a raw draft replaces the document. */
export function persistUnsavedDraft(
  token: string,
  draft: UnsavedInstanceDraft,
): Promise<InstanceDetail | RawInstance> {
  if (draft.rawJson !== undefined) {
    return replaceRawInstance(token, draft.instanceId, parseRawInstance(draft.rawJson));
  }
  const changes = changedFields(draft);
  if (draft.isNew) {
    if (!draft.typeIdentifier) {
      return Promise.reject(new Error("Open this instance to save it."));
    }
    return createInstance(token, draft.instanceId, draft.typeIdentifier, changes, draft.space);
  }
  return updateInstance(token, draft.instanceId, changes);
}
