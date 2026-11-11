import React from "react";
import { Spinner } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useTools } from "../../contexts/ToolsContext";
import ToolCategoryIcon from "../../components/ToolCategoryIcon";
import "../home/SuiteHome.css";

/** The overview of the tools of a category - each opens on its own in a new tab. */
export default function ToolsHome() {
  const { categoryId } = useParams();
  const { categories, error } = useTools();

  if (!categories) {
    return (
      <p className="suite-home-status">
        <Spinner animation="border" size="sm" /> Loading tools...
      </p>
    );
  }

  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    return <p className="suite-home-status">{error ?? "This category doesn't exist or has no tools available to you."}</p>;
  }

  return (
    <div className="suite-home">
      <header className="suite-home-header">
        <h2 className="suite-home-title">{category.name}</h2>
        <p className="suite-home-subtitle">Tools built on top of the knowledge graph - each opens in a new tab.</p>
      </header>
      <ul aria-label={category.name} className="suite-home-grid suite-home-list">
        {category.tools.map((tool) => {
          const titleId = `tool-${tool.id}-title`;
          return (
            <li key={tool.id} className="suite-home-card suite-home-card-static" aria-labelledby={titleId}>
              <span className="suite-home-card-icon" aria-hidden="true">
                <ToolCategoryIcon icon={category.icon} size={22} />
              </span>
              <h3 id={titleId} className="suite-home-card-title">
                {tool.name}
              </h3>
              {tool.description && <p className="suite-home-card-description">{tool.description}</p>}
              <div className="suite-home-card-action">
                <a className="btn btn-outline-secondary btn-sm" href={tool.endpoint} target="_blank" rel="noopener noreferrer">
                  Open tool
                  <ExternalLink size={14} className="ms-2" aria-hidden="true" />
                  <span className="visually-hidden"> {tool.name} (opens in a new tab)</span>
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
