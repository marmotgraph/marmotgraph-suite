import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import CodeMirror from "@uiw/react-codemirror";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import SaveButton from "../../components/SaveButton";
import { jsonEditorSetup, jsonExtensions } from "../../components/jsonEditor";
import { defineValidationSchema, deleteValidationSchema, fetchValidationSchemas, ValidationSchema } from "../../services/modeler";

/** The schema a new validation schema starts with. */
const TEMPLATE = { type: "object", required: [], properties: {} };

/** The JSON object of the text - undefined if it isn't one. */
function parseObject(text: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The JSON-Schema documents attached to a type - the instances of the type are validated against them. */
export default function ValidationSchemas({ type, canDefine }: { type: string; canDefine: boolean }) {
  const { getAccessToken } = useAuth();
  const [schemas, setSchemas] = useState<ValidationSchema[]>();
  const [error, setError] = useState<string>();
  const [newName, setNewName] = useState("");

  const load = useCallback(() => {
    getAccessToken()
      .then((token) => fetchValidationSchemas(token, type))
      .then((s) => setSchemas(s ?? []))
      .catch((e: Error) => setError(e.message));
  }, [getAccessToken, type]);

  useEffect(load, [load]);

  const save = async (name: string, schema: Record<string, unknown>) => {
    setError(undefined);
    try {
      await defineValidationSchema(await getAccessToken(), type, name, schema);
      load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const remove = async (name: string) => {
    if (!window.confirm(`Delete the validation schema "${name}"?`)) {
      return;
    }
    setError(undefined);
    try {
      await deleteValidationSchema(await getAccessToken(), type, name);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const trimmedName = newName.trim();
  const duplicate = !!schemas?.some((schema) => schema.name === trimmedName);

  return (
    <div>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      <p className="text-muted small">
        The instances of the type are validated against these <a href="https://json-schema.org/" target="_blank" rel="noreferrer">JSON schemas</a>.
      </p>
      {canDefine && (
        <Form
          className="d-flex gap-2 mb-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (trimmedName && !duplicate && (await save(trimmedName, TEMPLATE))) {
              setNewName("");
            }
          }}
        >
          <Form.Control
            size="sm"
            placeholder="Name of the new schema"
            value={newName}
            isInvalid={duplicate}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="Name of the new schema"
          />
          <Button size="sm" variant="dark" type="submit" disabled={!trimmedName || duplicate} className="d-flex align-items-center text-nowrap">
            <Plus size={16} className="me-1" />
            Add schema
          </Button>
        </Form>
      )}
      {!schemas && !error && (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" /> Loading validation schemas...
        </div>
      )}
      {schemas?.length === 0 && <p className="text-muted">No validation schemas are defined for the type.</p>}
      {schemas?.map((schema) => (
        <SchemaEditor
          key={`${schema.name} ${JSON.stringify(schema.schema)}`}
          schema={schema}
          canDefine={canDefine}
          onSave={(value) => save(schema.name, value)}
          onDelete={() => remove(schema.name)}
        />
      ))}
    </div>
  );
}

function SchemaEditor({
  schema,
  canDefine,
  onSave,
  onDelete,
}: {
  schema: ValidationSchema;
  canDefine: boolean;
  onSave: (schema: Record<string, unknown>) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(schema.schema, null, 2));
  const parsed = parseObject(text);
  return (
    <Card className="mb-3">
      <Card.Header className="d-flex align-items-center py-2">
        <span className="fw-semibold">{schema.name}</span>
        {canDefine && (
          <Button
            size="sm"
            variant="link"
            className="ms-auto p-1 text-danger"
            title="Delete"
            aria-label={`Delete ${schema.name}`}
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </Button>
        )}
      </Card.Header>
      <Card.Body>
        <CodeMirror
          className={`json-field form-control p-0${parsed ? "" : " is-invalid"}`}
          value={text}
          maxHeight="50vh"
          extensions={jsonExtensions}
          basicSetup={jsonEditorSetup}
          editable={canDefine}
          onChange={setText}
        />
        <Form.Control.Feedback type="invalid">The schema needs to be a valid JSON object.</Form.Control.Feedback>
        {canDefine && (
          <div className="mt-3">
            <SaveButton disabled={!parsed} onSave={() => onSave(parsed!)} />
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
