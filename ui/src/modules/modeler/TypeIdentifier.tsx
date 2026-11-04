import React, { useEffect, useState } from "react";
import { Copy } from "lucide-react";

/** The identifier (IRI) of a type or property - on one line, with the control to copy it. */
export default function TypeIdentifier({ identifier }: { identifier: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <div className="modeler-id">
      <span className="modeler-id-text" title={identifier}>
        {identifier}
      </span>
      <button
        type="button"
        className="copy-id-wrapper modeler-copy"
        aria-label="Copy identifier"
        onClick={(e) => {
          e.stopPropagation();
          void navigator.clipboard?.writeText(identifier);
          setCopied(true);
        }}
      >
        <Copy size={12} aria-hidden />
        <span className="copy-id-tooltip">{copied ? "Identifier copied!" : "Copy identifier"}</span>
      </button>
    </div>
  );
}
