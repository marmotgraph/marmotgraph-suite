import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { AppConfig, ServiceUnavailableError, fetchConfig } from "../services/config";
import { applyTenantStylesheet } from "../services/tenants";
import { applyTenantUiStyle } from "../tenants/tenantStyles";
import StartupStatus from "../components/StartupStatus";
import Outage from "../components/Outage";

const ConfigContext = createContext<AppConfig | undefined>(undefined);

/**
 * Loads the configuration from the server and only renders its children once it is available. While the suite backend
 * or the MarmotGraph core is unreachable, the outage page is shown instead - nothing depending on them (e.g. the login)
 * is rendered.
 */
export function ConfigProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [config, setConfig] = useState<AppConfig>();
  const [error, setError] = useState<string>();
  const [outage, setOutage] = useState<ServiceUnavailableError>();
  const [checking, setChecking] = useState(true);

  const load = useCallback(() => {
    // The outage page stays while the connection is checked again
    setError(undefined);
    setChecking(true);
    fetchConfig()
      .then(async (loaded) => {
        applyTenantStylesheet(loaded.coreUrl, loaded.tenant);
        // Tenants with their own UI style (e.g. CSCS) get it before the UI is shown - everyone else keeps the default
        await applyTenantUiStyle(loaded.tenant);
        setOutage(undefined);
        setConfig(loaded);
      })
      .catch(async (e: Error) => {
        if (e instanceof ServiceUnavailableError) {
          await applyTenantUiStyle(e.tenant);
          setOutage(e);
        } else {
          setOutage(undefined);
          setError(e.message);
        }
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(load, [load]);

  if (outage) {
    return <Outage outage={outage} checking={checking} onRetry={load} />;
  }
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
