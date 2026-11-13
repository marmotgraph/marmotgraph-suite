import React, { useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { useAuth } from "../../contexts/AuthContext";
import { deleteSpaceSpecification, saveSpaceSpecification, SpaceSettings } from "../../services/spaces";

export const DEFAULT_SETTINGS: SpaceSettings = { autoRelease: false, clientSpace: false, deferCache: false };

/** The spaces of the core which can't be specified: the private space of the user and the one of the invitations. */
const RESERVED_SPACES = ["myspace", "review"];

/**
 * The settings of a space which can be changed, with their labels. The other settings ("clientSpace" and
 * "deferCache") are deprecated - they are kept as they are when the settings are saved.
 */
export const SPACE_SETTINGS: { key: keyof SpaceSettings; label: string; description?: string }[] = [
  { key: "autoRelease", label: "Auto release", description: "Instances are released automatically when they change." },
];

/** Validates the name of a new space - the same rules as the backend, nothing is reported for an empty name. */
export function spaceNameError(name: string, existing: string[]): string | undefined {
  if (!name) {
    return undefined;
  }
  if (!/^[\w.-]+$/.test(name)) {
    return 'Space names may only contain letters, digits, ".", "-" and "_"';
  }
  if (RESERVED_SPACES.includes(name)) {
    return "This name is reserved";
  }
  return existing.includes(name) ? "A space with this name already exists" : undefined;
}

/** The checkboxes of the settings of a space. */
export function SpaceSettingsFields({ settings, disabled, onChange }: {
  settings: SpaceSettings;
  disabled?: boolean;
  onChange: (settings: SpaceSettings) => void;
}) {
  return (
    <>
      {SPACE_SETTINGS.map(({ key, label, description }) => (
        <Form.Group key={key} className="mb-2" controlId={`admin-space-${key}`}>
          <Form.Check
            type="checkbox"
            label={label}
            disabled={disabled}
            checked={settings[key]}
            onChange={(e) => onChange({ ...settings, [key]: e.target.checked })}
          />
          {description && <Form.Text muted>{description}</Form.Text>}
        </Form.Group>
      ))}
    </>
  );
}

/**
 * Adds a space by specifying it.
 *
 * @param existing the identifiers of the spaces already known - a new space can't take one of them
 */
export function AddSpaceModal({ existing, onHide, onAdded }: {
  existing: string[];
  onHide: () => void;
  onAdded: (space: string) => void;
}) {
  const { getAccessToken } = useAuth();
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<SpaceSettings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const identifier = name.trim();
  const nameError = spaceNameError(identifier, existing);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!identifier || nameError) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await saveSpaceSpecification(await getAccessToken(), identifier, settings);
      onAdded(identifier);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal show onHide={onHide} centered className="admin-modal">
      <Form onSubmit={save}>
        <Modal.Header closeButton>
          <Modal.Title>Add space</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group className="mb-3" controlId="admin-space-name">
            <Form.Label>Name</Form.Label>
            <Form.Control
              size="sm"
              autoFocus
              value={name}
              isInvalid={!!nameError}
              onChange={(e) => setName(e.target.value)}
            />
            <Form.Control.Feedback type="invalid">{nameError}</Form.Control.Feedback>
          </Form.Group>
          <SpaceSettingsFields settings={settings} onChange={setSettings} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit" variant="dark" disabled={busy || !identifier || !!nameError}>
            {busy ? <Spinner animation="border" size="sm" /> : "Add"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/** Asks for the confirmation to delete the specification of the given space and deletes it. */
export function DeleteSpaceModal({ space, onHide, onDeleted }: {
  space: string;
  onHide: () => void;
  onDeleted: () => void;
}) {
  const { getAccessToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const remove = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await deleteSpaceSpecification(await getAccessToken(), space);
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal show onHide={onHide} centered className="admin-modal">
      <Modal.Header closeButton>
        <Modal.Title>Delete specification</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <p>
          Delete the specification of the space <strong className="admin-space-name">{space}</strong>?
        </p>
        <p className="mb-0">
          A space without types is removed. Otherwise, it stays with the default settings. The claims of the space are
          not removed.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="danger" disabled={busy} onClick={remove}>
          {busy ? <Spinner animation="border" size="sm" /> : "Delete specification"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
