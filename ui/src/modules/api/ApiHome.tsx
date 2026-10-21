import React from "react";
import { useConfig } from "../../contexts/ConfigContext";
import "./ApiHome.css";

/** Embeds the swagger-ui of the linked MarmotGraph core. */
export default function ApiHome() {
  const { coreUrl } = useConfig();
  const swaggerUrl = `${coreUrl.replace(/\/+$/, "")}/swagger-ui/index.html`;

  return <iframe className="api-swagger-frame" src={swaggerUrl} title="MarmotGraph core API" />;
}
