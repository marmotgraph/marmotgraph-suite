import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import CodeMirror from "@uiw/react-codemirror";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchRawInstance,
  RawInstance,
  replaceRawInstance,
} from "../services/instances";
import { jsonEditorSetup, jsonExtensions } from "./jsonEditor";
import "./InstanceFieldControl.css";
import "./RawInstanceEditor.css";

function toJsonText(instance: RawInstance): string {
  return JSON.stringify(instance, null, 2);
}

/** Parses the edited text - undefined if it is no JSON object (the core only accepts objects as instances). */
function parseInstance(text: string): RawInstance | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? (parsed as RawInstance)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Shows the full JSON-LD document of an instance as provided by the core - editable if the user is allowed to edit the
 * instance (saving replaces the whole instance). The edited text is kept by the caller (as a draft) so it survives
 * leaving the instance.
 */
export default function RawInstanceEditor({
  instanceId,
  canEdit,
  draftText,
  onDraftChange,
  onSaved,
}: {
  instanceId: string;
  canEdit: boolean;
  /** The edited text - undefined if the stored document is shown unchanged */
  draftText?: string;
  /** Called with the edited text - undefined if it doesn't deviate from the stored document (anymore) */
  onDraftChange: (text: string | undefined) => void;
  /** Called once the edited document is stored by the core */
  onSaved: () => void;
}) {
  const { getAccessToken } = useAuth();
  const [savedText, setSavedText] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then((token) => fetchRawInstance(token, instanceId))
      .then((loaded) => {
        if (!cancelled) {
          setSavedText(toJsonText(loaded));
        }
      })
      .catch((e: unknown) => {
        console.error("Failed to load the raw instance", e);
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, instanceId]);

  const text = draftText ?? savedText ?? "";
  const parsed = useMemo(() => parseInstance(text), [text]);
  const isDirty = draftText !== undefined;

  if (loadError) {
    return <Alert variant="danger">{loadError}</Alert>;
  }

  if (savedText === undefined) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" role="status" className="me-2" />
        Loading JSON...
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="raw-instance">
        <CodeMirror
          className="json-field json-field--readonly raw-instance-json"
          value={savedText}
          maxHeight="70vh"
          extensions={jsonExtensions}
          basicSetup={jsonEditorSetup}
          editable={false}
        />
      </div>
    );
  }

  const handleSave = () => {
    if (!parsed) {
      return;
    }
    setSaving(true);
    setSaveError(undefined);
    getAccessToken()
      .then((token) => replaceRawInstance(token, instanceId, parsed))
      .then((stored) => {
        setSavedText(toJsonText(stored));
        onSaved();
      })
      .catch((e: unknown) => {
        console.error("Failed to save the raw instance", e);
        setSaveError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setSaving(false));
  };

  const handleChange = (newText: string) =>
    onDraftChange(newText === savedText ? undefined : newText);

  const handleReset = () => {
    onDraftChange(undefined);
    setSaveError(undefined);
  };

  return (
    <div className="raw-instance">
      <CodeMirror
        className={`json-field form-control p-0 raw-instance-json${parsed ? "" : " is-invalid"}`}
        value={text}
        maxHeight="70vh"
        extensions={jsonExtensions}
        basicSetup={jsonEditorSetup}
        onChange={handleChange}
        editable={!saving}
      />
      <Form.Control.Feedback type="invalid">
        The instance needs to be a valid JSON object.
      </Form.Control.Feedback>
      {saveError && (
        <Alert variant="danger" className="mt-3 mb-0">
          {saveError}
        </Alert>
      )}
      <div
        className={`instance-form-actions-commit mt-4${!isDirty ? " instance-form-actions-commit--unchanged" : ""}`}
        title={!isDirty ? "Nothing to change" : undefined}
      >
        <Button
          variant="outline-secondary"
          onClick={handleReset}
          disabled={!isDirty || saving}
        >
          Cancel
        </Button>
        <Button
          variant="dark"
          onClick={handleSave}
          disabled={!isDirty || !parsed || saving}
        >
          {saving && <Spinner animation="border" size="sm" className="me-2" />}
          Save
        </Button>
      </div>
    </div>
  );
}
