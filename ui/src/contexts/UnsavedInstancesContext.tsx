import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { InstanceFieldValues } from "../modules/editor/editorMockData";

/** Drafts survive a reload of the document, so leaving an instance does not drop the others. */
export const UNSAVED_INSTANCES_STORAGE_KEY = "marmotgraph.unsaved-instances";

export type UnsavedInstanceDraft = {
  instanceId: string;
  instanceName: string;
  type: string;
  fieldValues: InstanceFieldValues;
  updatedAt: number;
  isNew?: boolean;
  /** The identifier of the type of a new instance - type holds its label */
  typeIdentifier?: string;
  /** The space a new instance is created in - the private space of the user if there is none */
  space?: string;
  /** The stored field values the draft was edited from, so a save sends only the changes */
  baseline?: InstanceFieldValues;
  changedFieldLabels?: string[];
  /** The edited JSON document if the instance was changed in the raw mode (the field values are unchanged then) */
  rawJson?: string;
  /** The stored instance has incoming links. Other drafts that link here count as well. */
  hasReverseLinks?: boolean;
};

type UnsavedInstancesContextType = {
  drafts: UnsavedInstanceDraft[];
  getDraft: (instanceId: string) => UnsavedInstanceDraft | undefined;
  upsertDraft: (draft: UnsavedInstanceDraft) => void;
  removeDraft: (instanceId: string) => void;
};

const UnsavedInstancesContext = createContext<
  UnsavedInstancesContextType | undefined
>(undefined);

function isStoredDraft(value: unknown): value is UnsavedInstanceDraft {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const draft = value as UnsavedInstanceDraft;
  return (
    typeof draft.instanceId === "string" &&
    typeof draft.instanceName === "string" &&
    typeof draft.type === "string" &&
    typeof draft.fieldValues === "object" &&
    draft.fieldValues !== null &&
    typeof draft.updatedAt === "number"
  );
}

function readStoredDrafts(): Record<string, UnsavedInstanceDraft> {
  try {
    const raw = sessionStorage.getItem(UNSAVED_INSTANCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const drafts: Record<string, UnsavedInstanceDraft> = {};
    for (const [instanceId, value] of Object.entries(parsed)) {
      if (isStoredDraft(value) && value.instanceId === instanceId) {
        drafts[instanceId] = value;
      }
    }
    return drafts;
  } catch {
    return {};
  }
}

function writeStoredDrafts(drafts: Record<string, UnsavedInstanceDraft>) {
  try {
    sessionStorage.setItem(UNSAVED_INSTANCES_STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // The rail still holds the drafts for this document if storage is full.
  }
}

export function UnsavedInstancesProvider({ children }: { children: ReactNode }) {
  const [draftsById, setDraftsById] = useState<
    Record<string, UnsavedInstanceDraft>
  >(readStoredDrafts);

  useEffect(() => {
    writeStoredDrafts(draftsById);
  }, [draftsById]);

  const getDraft = useCallback(
    (instanceId: string) => draftsById[instanceId],
    [draftsById],
  );

  const upsertDraft = useCallback((draft: UnsavedInstanceDraft) => {
    setDraftsById((previous) => ({
      ...previous,
      [draft.instanceId]: draft,
    }));
  }, []);

  const removeDraft = useCallback((instanceId: string) => {
    setDraftsById((previous) => {
      if (!previous[instanceId]) {
        return previous;
      }

      const next = { ...previous };
      delete next[instanceId];
      return next;
    });
  }, []);

  const drafts = useMemo(
    () =>
      Object.values(draftsById).sort(
        (left, right) => right.updatedAt - left.updatedAt,
      ),
    [draftsById],
  );

  return (
    <UnsavedInstancesContext.Provider
      value={{ drafts, getDraft, upsertDraft, removeDraft }}
    >
      {children}
    </UnsavedInstancesContext.Provider>
  );
}

export function useUnsavedInstances() {
  const context = useContext(UnsavedInstancesContext);

  if (!context) {
    throw new Error(
      "useUnsavedInstances must be used within an UnsavedInstancesProvider",
    );
  }

  return context;
}
