import { useCallback, useState } from "react";
import { useInstances } from "../../contexts/InstancesContext";
import {
  UnsavedInstanceDraft,
  useUnsavedInstances,
} from "../../contexts/UnsavedInstancesContext";
import { setInstanceFieldValues } from "./editorMockData";
import {
  buildSavePlan,
  executeSavePlan,
  SaveExecutionResult,
  SavePlan,
} from "./instanceSave";

type PendingSave = {
  rootIds: string[];
  plan: SavePlan;
};

type UseInstanceSaveOptions = {
  onSaveComplete?: (
    result: SaveExecutionResult,
    rootIds: string[],
  ) => void;
};

export function useInstanceSave(options: UseInstanceSaveOptions = {}) {
  const { onSaveComplete } = options;
  const { instances, addInstance, updateInstance, getInstance } =
    useInstances();
  const { getDraft, removeDraft, flushLiveDrafts } = useUnsavedInstances();
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const runSave = useCallback(
    (rootIds: string[]) => {
      setIsSaving(true);
      setSaveError(null);

      try {
        flushLiveDrafts(rootIds);
        const result = executeSavePlan({
          instanceIds: rootIds,
          getDraft,
          getInstance,
          instances,
          addInstance,
          updateInstance,
          setInstanceFieldValues,
          removeDraft,
        });

        setPendingSave(null);
        onSaveComplete?.(result, rootIds);
        return result;
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : "Unable to save instances.",
        );
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [
      addInstance,
      flushLiveDrafts,
      getDraft,
      getInstance,
      instances,
      onSaveComplete,
      removeDraft,
      updateInstance,
    ],
  );

  const requestSave = useCallback(
    (rootIds: string[]) => {
      const uniqueRootIds = [...new Set(rootIds)].filter(Boolean);

      if (uniqueRootIds.length === 0) {
        return;
      }

      flushLiveDrafts(uniqueRootIds);
      const plan = buildSavePlan(uniqueRootIds, getDraft);

      if (!plan.requiresConfirmation) {
        runSave(uniqueRootIds);
        return;
      }

      setPendingSave({ rootIds: uniqueRootIds, plan });
      setSaveError(null);
    },
    [flushLiveDrafts, getDraft, runSave],
  );

  const confirmPendingSave = useCallback(
    (selectedIds: string[]) => {
      if (selectedIds.length === 0) {
        return;
      }

      runSave(selectedIds);
    },
    [runSave],
  );

  const cancelPendingSave = useCallback(() => {
    setPendingSave(null);
    setSaveError(null);
  }, []);

  return {
    requestSave,
    pendingSave,
    confirmPendingSave,
    cancelPendingSave,
    isSaving,
    saveError,
  };
}

export type LiveDraftSnapshot = Omit<
  UnsavedInstanceDraft,
  "updatedAt"
>;
