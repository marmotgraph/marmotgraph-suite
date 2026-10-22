import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchGlobalFunctionalities } from "../services/users";

/**
 * Loads the functionalities the user is granted globally - undefined until they are available (empty if loading
 * failed, so nothing is shown that requires them).
 */
export function useGlobalFunctionalities(): string[] | undefined {
  const { getAccessToken } = useAuth();
  const [functionalities, setFunctionalities] = useState<string[]>();

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then(fetchGlobalFunctionalities)
      .then((f) => !cancelled && setFunctionalities(f))
      .catch((e: unknown) => {
        console.error("Failed to load the permissions of the user", e);
        if (!cancelled) {
          setFunctionalities([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  return functionalities;
}
