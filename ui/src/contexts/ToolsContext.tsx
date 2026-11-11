import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { CategoryWithTools, fetchTools } from "../services/tools";

interface ToolsState {
  /** The categories with the tools available to the user - undefined while loading, empty if loading failed */
  categories?: CategoryWithTools[];
  error?: string;
  /** Loads the tools again - e.g. after they were changed in the admin module */
  reload: () => void;
}

const ToolsContext = createContext<ToolsState>({ reload: () => undefined });

/**
 * Loads the tools built on top of the graph once the user is authenticated - they depend on the user, which is why they
 * aren't part of the configuration. The navigation and the tool pages share them.
 */
export function ToolsProvider({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();
  const [categories, setCategories] = useState<CategoryWithTools[]>();
  const [error, setError] = useState<string>();
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then(fetchTools)
      .then((loaded) => {
        if (!cancelled) {
          setCategories(loaded);
          setError(undefined);
        }
      })
      .catch((e: Error) => {
        console.error("Failed to load the tools", e);
        if (!cancelled) {
          setCategories([]);
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, generation]);

  const reload = useCallback(() => setGeneration((g) => g + 1), []);

  return <ToolsContext.Provider value={{ categories, error, reload }}>{children}</ToolsContext.Provider>;
}

export function useTools(): ToolsState {
  return useContext(ToolsContext);
}
