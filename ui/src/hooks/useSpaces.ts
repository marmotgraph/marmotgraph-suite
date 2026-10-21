import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchSpaces, SpaceDefinition } from "../services/spaces";

/** Loads the spaces known to the core - empty until they are available (or if loading failed). */
export function useSpaces(): SpaceDefinition[] {
  const { getAccessToken } = useAuth();
  const [spaces, setSpaces] = useState<SpaceDefinition[]>([]);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then(fetchSpaces)
      .then((s) => !cancelled && setSpaces(s))
      .catch((e: unknown) => console.error("Failed to load the spaces", e));
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  return spaces;
}
