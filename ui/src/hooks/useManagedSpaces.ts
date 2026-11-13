import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchManagedSpaces, ManagedSpace } from "../services/spaces";

/**
 * Loads the spaces the user is allowed to manage - undefined until they are available (empty if loading failed, so
 * nothing is shown that requires them). The error is kept to be reported by the views which depend on the spaces.
 */
export function useManagedSpaces(): { spaces?: ManagedSpace[]; error?: string; reload: () => void } {
  const { getAccessToken } = useAuth();
  const [spaces, setSpaces] = useState<ManagedSpace[]>();
  const [error, setError] = useState<string>();
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then(fetchManagedSpaces)
      .then((s) => {
        if (!cancelled) {
          setSpaces(s);
          setError(undefined);
        }
      })
      .catch((e: Error) => {
        console.error("Failed to load the spaces to manage", e);
        if (!cancelled) {
          setSpaces((current) => current ?? []);
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, generation]);

  const reload = useCallback(() => setGeneration((g) => g + 1), []);
  return { spaces, error, reload };
}

/** The global functionality to create spaces (and to manage all of them). */
export const MANAGE_SPACE = "MANAGE_SPACE";

/** If the space management is available - the user manages at least one space or may create spaces. */
export function spaceManagementAvailable(spaces: ManagedSpace[] | undefined, functionalities: string[] | undefined): boolean {
  return !!spaces?.length || !!functionalities?.includes(MANAGE_SPACE);
}
