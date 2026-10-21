import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchTypes, TypeDefinition } from "../services/types";

/** Loads the types known to the core - empty until they are available (or if loading failed). */
export function useTypes(): TypeDefinition[] {
  const { getAccessToken } = useAuth();
  const [types, setTypes] = useState<TypeDefinition[]>([]);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then(fetchTypes)
      .then((t) => !cancelled && setTypes(t))
      .catch((e: unknown) => console.error("Failed to load the types", e));
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  return types;
}
