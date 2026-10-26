import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Form, Spinner } from "react-bootstrap";
import { useAuth } from "../../contexts/AuthContext";
import { useSpaces } from "../../hooks/useSpaces";
import { assignSpace, fetchAssignedSpaces, ModelType } from "../../services/modeler";

/**
 * The spaces a type is applicable for - it is explicitly assigned to them (e.g. to be offered when creating instances
 * there). The spaces the type actually occurs in are shown as well.
 */
export default function TypeSpaces({ type, canDefine }: { type: ModelType; canDefine: boolean }) {
  const { getAccessToken } = useAuth();
  const spaces = useSpaces();
  const [assigned, setAssigned] = useState<string[]>();
  const [pending, setPending] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    getAccessToken()
      .then((token) => fetchAssignedSpaces(token, type.identifier))
      .then((s) => setAssigned(s ?? []))
      .catch((e: Error) => setError(e.message));
  }, [getAccessToken, type.identifier]);

  useEffect(load, [load]);

  const toggle = async (space: string, assign: boolean) => {
    setError(undefined);
    setPending((current) => [...current, space]);
    try {
      await assignSpace(await getAccessToken(), type.identifier, space, assign);
      setAssigned((current) => (assign ? [...(current ?? []), space] : (current ?? []).filter((s) => s !== space)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending((current) => current.filter((s) => s !== space));
    }
  };

  const needle = filter.trim().toLowerCase();
  const visible = spaces.filter((space) => !needle || space.identifier.toLowerCase().includes(needle));

  return (
    <div>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      <h6>Occurs in</h6>
      {type.spaces.length === 0 ? (
        <p className="text-muted small">There are no instances of the type yet.</p>
      ) : (
        <div className="d-flex flex-wrap gap-1 mb-3">
          {type.spaces.map((space) => (
            <Badge key={space} bg="light" text="dark">
              {space}
            </Badge>
          ))}
        </div>
      )}
      <h6 className="mt-3">Applicable in</h6>
      <p className="text-muted small">The spaces the type is assigned to.</p>
      {!assigned && !error ? (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" /> Loading spaces...
        </div>
      ) : (
        <>
          {spaces.length > 10 && (
            <Form.Control
              size="sm"
              type="search"
              className="mb-2 modeler-filter"
              placeholder="Filter spaces..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter spaces"
            />
          )}
          <div className="modeler-checklist modeler-checklist-tall">
            {visible.map((space) => (
              <Form.Check
                key={space.identifier}
                type="switch"
                id={`modeler-space-${space.identifier}`}
                label={space.identifier}
                disabled={!canDefine || pending.includes(space.identifier)}
                checked={!!assigned?.includes(space.identifier)}
                onChange={(e) => toggle(space.identifier, e.target.checked)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
