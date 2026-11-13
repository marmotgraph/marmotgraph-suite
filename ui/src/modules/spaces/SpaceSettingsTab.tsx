import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import SaveButton from "../../components/SaveButton";
import { DisabledHint } from "../../components/DisabledHint";
import { fetchSpaceDetails, saveSpaceSpecification, SpaceDetails, SpaceSettings } from "../../services/spaces";
import { DeleteSpaceModal, SpaceSettingsFields } from "./SpaceModals";

/** The specification of the space - its settings can be saved and the specification can be deleted. */
export default function SpaceSettingsTab({ space, onDeleted }: { space: string; onDeleted: () => void }) {
  const { getAccessToken } = useAuth();
  const [details, setDetails] = useState<SpaceDetails>();
  const [settings, setSettings] = useState<SpaceSettings>();
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    getAccessToken()
      .then((token) => fetchSpaceDetails(token, space))
      .then((d) => {
        setDetails(d);
        setSettings(d.settings);
      })
      .catch((e: Error) => setError(e.message));
  }, [getAccessToken, space]);

  useEffect(load, [load]);

  const save = async () => {
    if (!settings) {
      return false;
    }
    setError(undefined);
    try {
      await saveSpaceSpecification(await getAccessToken(), space, settings);
      setDetails({ identifier: space, settings, specified: true });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  if (!details || !settings) {
    return error ? (
      <Alert variant="danger">{error}</Alert>
    ) : (
      <div className="admin-loading">
        <Spinner animation="border" size="sm" /> Loading settings...
      </div>
    );
  }

  const changed = settingsChanged(details.settings, settings);

  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      {!details.specified && (
        <p className="admin-space-unspecified mb-3">
          The space has no specification yet - it has the default settings. Saving them specifies it.
        </p>
      )}
      <SpaceSettingsFields settings={settings} onChange={setSettings} />
      <div className="d-flex align-items-center mt-3">
        <DisabledHint reason={details.specified ? undefined : "This space has no specification"}>
          <Button
            size="sm"
            variant="link"
            className="edit-icon-btn admin-icon-btn admin-delete-btn"
            disabled={!details.specified}
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={14} aria-hidden className="me-1" /> Delete specification
          </Button>
        </DisabledHint>
        <div className="ms-auto">
          <SaveButton disabled={details.specified && !changed} onSave={save} />
        </div>
      </div>
      {deleting && (
        <DeleteSpaceModal
          space={space}
          onHide={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            onDeleted();
          }}
        />
      )}
    </Form>
  );
}

function settingsChanged(saved: SpaceSettings, current: SpaceSettings): boolean {
  return (Object.keys(saved) as (keyof SpaceSettings)[]).some((key) => saved[key] !== current[key]);
}
