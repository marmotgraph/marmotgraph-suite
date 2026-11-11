import React from "react";
import { ExternalLink } from "lucide-react";
import { useConfig } from "../../contexts/ConfigContext";
import { DOCUMENTATIONS } from "./documentations";
import "../home/SuiteHome.css";

/** The overview of the documentations - each opens on its own in a new tab. */
export default function DocumentationHome() {
  const config = useConfig();

  return (
    <div className="suite-home">
      <header className="suite-home-header">
        <h2 className="suite-home-title">Documentation</h2>
        <p className="suite-home-subtitle">Learn how MarmotGraph works and how to get the most out of your data.</p>
      </header>
      <ul aria-label="Documentation" className="suite-home-grid suite-home-list">
        {DOCUMENTATIONS.map((documentation) => {
          const url = documentation.url?.(config);
          const titleId = `documentation-${documentation.id}-title`;
          return (
            <li
              key={documentation.id}
              className={`suite-home-card suite-home-card-static ${url ? "" : "suite-home-card-unavailable"}`}
              aria-labelledby={titleId}
            >
              <span className="suite-home-card-icon" aria-hidden="true">
                {documentation.icon}
              </span>
              <h3 id={titleId} className="suite-home-card-title">
                {documentation.title}
              </h3>
              <p className="suite-home-card-description">{documentation.description}</p>
              <div className="suite-home-card-action">
                {url ? (
                  <a className="btn btn-outline-secondary btn-sm" href={url} target="_blank" rel="noopener noreferrer">
                    Open documentation
                    <ExternalLink size={14} className="ms-2" aria-hidden="true" />
                    <span className="visually-hidden"> {documentation.title} (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="suite-home-card-note">Not available yet</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
