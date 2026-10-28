import React, { useEffect, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import type { QuerySpace } from "../../services/queries";
import { spaceLabel } from "./useQueryBuilderData";

function SpaceSelect({
  spaces,
  value,
  onChange,
}: {
  spaces: QuerySpace[];
  value: string;
  onChange: (space: string) => void;
}) {
  return (
    <Form.Group className="mb-3" controlId="query-dialog-space">
      <Form.Label>Space</Form.Label>
      <Form.Select value={value} onChange={(e) => onChange(e.target.value)} disabled={!spaces.length}>
        {!spaces.length && <option value="">No space you can create queries in</option>}
        {spaces.map((space) => (
          <option key={space.identifier} value={space.identifier}>
            {spaceLabel(space)}
          </option>
        ))}
      </Form.Select>
      <Form.Text muted>Queries in a shared space can be used by everyone with access to it.</Form.Text>
    </Form.Group>
  );
}

/** Stores a new query (or a copy of one) - with its title, description and the space to store it in. */
export function SaveQueryModal({
  show,
  title,
  initialLabel,
  initialDescription,
  spaces,
  onCancel,
  onSave,
}: {
  show: boolean;
  title: string;
  initialLabel: string;
  initialDescription: string;
  /** The spaces the user can create queries in */
  spaces: QuerySpace[];
  onCancel: () => void;
  onSave: (label: string, description: string, space: string) => Promise<void>;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [description, setDescription] = useState(initialDescription);
  const [space, setSpace] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (show) {
      setLabel(initialLabel);
      setDescription(initialDescription);
      setSpace(spaces[0]?.identifier ?? "");
      setError(undefined);
    }
    // Only reset when the dialog is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const submit = () => {
    if (!label.trim() || !space || saving) {
      return;
    }
    setSaving(true);
    setError(undefined);
    onSave(label.trim(), description.trim(), space)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSaving(false));
  };

  return (
    <Modal show={show} onHide={onCancel} centered>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3" controlId="query-dialog-title">
            <Form.Label>
              Title <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control value={label} onChange={(e) => setLabel(e.target.value)} autoFocus required />
          </Form.Group>
          <Form.Group className="mb-3" controlId="query-dialog-description">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={description}
              placeholder="Optional - what the query is for"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Form.Group>
          <SpaceSelect spaces={spaces} value={space} onChange={setSpace} />
          {error && <Alert variant="danger">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="dark" disabled={!label.trim() || !space || saving}>
            {saving && <Spinner animation="border" size="sm" role="status" className="me-2" />}
            Save query
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/** Asks before deleting a stored query */
export function DeleteQueryModal({
  show,
  label,
  onCancel,
  onDelete,
}: {
  show: boolean;
  label: string;
  onCancel: () => void;
  onDelete: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (show) {
      setError(undefined);
    }
  }, [show]);

  const submit = () => {
    setDeleting(true);
    onDelete()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setDeleting(false));
  };

  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Delete query</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Delete <strong>{label}</strong>? This can&apos;t be undone.
        {error && (
          <Alert variant="danger" className="mt-3 mb-0">
            {error}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={submit} disabled={deleting}>
          {deleting && <Spinner animation="border" size="sm" role="status" className="me-2" />}
          Delete query
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
