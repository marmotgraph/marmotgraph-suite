import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { addComment, deleteComment, fetchComments, InstanceComment, updateComment } from "../services/comments";

/**
 * The comments on an instance - only loaded if enabled (the core rejects the requests of users without the permission
 * to comment). Failures of the modifications are thrown to the caller.
 */
export function useInstanceComments(instanceId: string, enabled: boolean) {
  const { getAccessToken } = useAuth();
  const [comments, setComments] = useState<InstanceComment[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadError, setLoadError] = useState<string>();
  /** Incremented to load the comments again (after a failure) */
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    setComments([]);
    setLoadError(undefined);
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAccessToken()
      .then((token) => fetchComments(token, instanceId))
      .then((loaded) => {
        if (!cancelled) {
          setComments(loaded);
        }
      })
      .catch((e: unknown) => {
        console.error("Failed to load the comments", e);
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, instanceId, enabled, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  const add = useCallback(
    async (property: string | undefined, text: string) => {
      const created = await addComment(await getAccessToken(), instanceId, property, text);
      setComments((current) => [...current, created]);
    },
    [getAccessToken, instanceId],
  );

  const update = useCallback(
    async (commentId: string, text: string) => {
      const updated = await updateComment(await getAccessToken(), instanceId, commentId, text);
      setComments((current) => current.map((comment) => (comment.id === commentId ? updated : comment)));
    },
    [getAccessToken, instanceId],
  );

  const remove = useCallback(
    async (commentId: string) => {
      await deleteComment(await getAccessToken(), instanceId, commentId);
      setComments((current) => current.filter((comment) => comment.id !== commentId));
    },
    [getAccessToken, instanceId],
  );

  return { comments, loading, loadError, reload, add, update, remove };
}

export type InstanceComments = ReturnType<typeof useInstanceComments>;
