import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { AppConfig, fetchConfig } from "../services/config";
import { applyTenantStylesheet } from "../services/tenants";
import { applyTenantUiStyle } from "../tenants/tenantStyles";
import StartupStatus from "../components/StartupStatus";

const ConfigContext = createContext<AppConfig | undefined>(undefined);

/** Loads the configuration from the server and only renders its children once it is available. */
export function ConfigProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [config, setConfig] = useState<AppConfig>();
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    setError(undefined);
    fetchConfig()
      .then(async (loaded) => {
        applyTenantStylesheet(loaded.coreUrl, loaded.tenant);
        // Tenants with their own UI style (e.g. CSCS) get it before the UI is shown - everyone else keeps the default
        await applyTenantUiStyle(loaded.tenant);
        setConfig(loaded);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  if (error) {
    return <StartupStatus error={error} onRetry={load} />;
  }
  if (!config) {
    return <StartupStatus message="Loading configuration..." />;
  }
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}
