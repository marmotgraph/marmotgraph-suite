import React, { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { jsonEditorSetup, jsonExtensions } from "../../components/jsonEditor";
import type { QuerySpecification } from "../../services/queries";
import "../../components/InstanceFieldControl.css";

/** Why the text can't be applied as query specification - undefined if it can. */
function problem(text: string): { error?: string; specification?: QuerySpecification } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { error: `The text is no valid JSON (${e instanceof Error ? e.message : String(e)})` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "A query specification needs to be a JSON object" };
  }
  const meta = (parsed as { meta?: { type?: unknown } }).meta;
  if (!meta || typeof meta.type !== "string" || !meta.type) {
    return { error: 'A query specification needs to define the type it starts from ("meta.type")' };
  }
  return { specification: parsed as QuerySpecification };
}

/**
 * The specification of the query as JSON. Every valid edit is applied to the query right away (the builder shows the
 * result) - the text is kept as typed while the editor is open.
 */
export default function QueryJsonEditor({
  initialText,
  onApply,
}: {
  initialText: string;
  onApply: (specification: QuerySpecification) => void;
}) {
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string>();

  const handleChange = (value: string) => {
    setText(value);
    const result = problem(value);
    setError(result.error);
    if (result.specification) {
      onApply(result.specification);
    }
  };

  return (
    <div className="query-json">
      <p className="query-panel-subtitle">
        Edit the specification directly - valid changes are applied to the query right away.
      </p>
      <CodeMirror
        className={`json-field${error ? " is-invalid" : ""}`}
        value={text}
        maxHeight="70vh"
        extensions={jsonExtensions}
        basicSetup={jsonEditorSetup}
        onChange={handleChange}
        aria-label="Query specification"
      />
      {error && (
        <div className="query-option-warning mt-2" role="alert">
          {error} - the last valid version is kept.
        </div>
      )}
    </div>
  );
}
