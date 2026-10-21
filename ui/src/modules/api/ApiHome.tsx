import React, { useEffect, useState } from "react";
import "./ApiHome.css";

/** Embeds the swagger-ui of the linked MarmotGraph core. */
export default function ApiHome() {
  const [swaggerUrl, setSwaggerUrl] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/config", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load the configuration (${response.status} ${response.statusText})`);
        }
        return response.json() as Promise<{ coreUrl?: string }>;
      })
      .then((config) => {
        if (cancelled) {
          return;
        }
        if (!config.coreUrl) {
          throw new Error("The configuration has no core URL");
        }
        setSwaggerUrl(`${config.coreUrl.replace(/\/+$/, "")}/swagger-ui/index.html`);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p>{error}</p>;
  }
  if (!swaggerUrl) {
    return <p>Loading API documentation...</p>;
  }
  return <iframe className="api-swagger-frame" src={swaggerUrl} title="MarmotGraph core API" />;
}
