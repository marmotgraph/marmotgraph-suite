import React from "react";
import { ExternalLink } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useUnsavedInstances } from "../contexts/UnsavedInstancesContext";

/** Replaces the general navigation while embedded in an iframe: leads to the current page in a tab of its own. */
export default function EmbeddedBar() {
  const { pathname, search, hash } = useLocation();
  const { drafts } = useUnsavedInstances();

  return (
    <div className="layout-embedded-bar">
      {/* Unsaved changes are only kept in this page */}
      {drafts.length > 0 && (
        <span className="layout-embedded-unsaved">
          {drafts.length === 1 ? "1 unsaved instance stays here" : `${drafts.length} unsaved instances stay here`}
        </span>
      )}
      <a className="layout-embedded-open" href={`${pathname}${search}${hash}`} target="_blank" rel="noopener">
        <ExternalLink size={16} aria-hidden="true" />
        Open in new tab
      </a>
    </div>
  );
}
