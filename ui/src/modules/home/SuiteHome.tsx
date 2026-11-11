import React from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useConfig } from "../../contexts/ConfigContext";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";
import { SUITE_MODULES } from "./modules";
import "./SuiteHome.css";

/** The home screen of the suite - a box for each of its modules. */
export default function SuiteHome() {
  const { tenant } = useConfig();
  const functionalities = useGlobalFunctionalities();
  const modules = SUITE_MODULES.filter((module) => !module.available || module.available(functionalities));

  return (
    <div className="suite-home">
      <header className="suite-home-header">
        <h2 className="suite-home-title">{tenant ? `${tenant} Knowledge Graph Suite` : "Knowledge Graph Suite"}</h2>
        <p className="suite-home-subtitle">Choose a module to get started.</p>
      </header>
      <nav aria-label="Modules" className="suite-home-grid">
        {modules.map((module) => (
          <Link key={module.id} to={module.path} className="suite-home-card">
            <span className="suite-home-card-icon" aria-hidden="true">
              {module.icon}
            </span>
            <span className="suite-home-card-title">{module.title}</span>
            <span className="suite-home-card-description">{module.description}</span>
          </Link>
        ))}
      </nav>
      <aside className="suite-home-docs" aria-labelledby="suite-home-docs-title">
        <span className="suite-home-docs-icon" aria-hidden="true">
          <BookOpen size={20} />
        </span>
        <div className="suite-home-docs-text">
          <h3 id="suite-home-docs-title" className="suite-home-docs-title">
            Documentation
          </h3>
          <p className="suite-home-docs-description">
            New to MarmotGraph? Learn how the modules work and how to get the most out of your data.
          </p>
        </div>
        <Link className="btn btn-outline-secondary btn-sm" to="/documentation">
          Browse documentation
        </Link>
      </aside>
    </div>
  );
}
