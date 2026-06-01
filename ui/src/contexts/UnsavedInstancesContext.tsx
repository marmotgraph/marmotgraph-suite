import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { InstanceFieldValues } from "../modules/editor/editorMockData";

export type UnsavedInstanceDraft = {
  instanceId: string;
  instanceName: string;
  type: string;
  fieldValues: InstanceFieldValues;
  updatedAt: number;
  isNew?: boolean;
  changedFieldLabels?: string[];
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

export function UnsavedInstancesProvider({ children }: { children: ReactNode }) {
  const [draftsById, setDraftsById] = useState<
    Record<string, UnsavedInstanceDraft>
  >({});

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
