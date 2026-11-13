import React, { useCallback, useEffect, useState } from "react";
import { Alert, Form, Spinner } from "react-bootstrap";
import { useAuth } from "../../contexts/AuthContext";
import { assignType, fetchSpaceTypes, SpaceType } from "../../services/spaces";
import { shortName } from "../../services/modeler";

type Scope = "all" | "assigned" | "unassigned";

/**
 * The types assigned to the space (e.g. to be offered when creating instances there) - each type can be assigned or
 * removed. How often a type occurs in the space is shown as well.
 */
export default function SpaceTypes({ space }: { space: string }) {
  const { getAccessToken } = useAuth();
  const [types, setTypes] = useState<SpaceType[]>();
  const [pending, setPending] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    getAccessToken()
      .then((token) => fetchSpaceTypes(token, space))
      .then(setTypes)
      .catch((e: Error) => setError(e.message));
  }, [getAccessToken, space]);

  useEffect(load, [load]);

  const toggle = async (type: string, assign: boolean) => {
    setError(undefined);
    setPending((current) => [...current, type]);
    try {
      await assignType(await getAccessToken(), space, type, assign);
      setTypes((current) => current?.map((t) => (t.identifier === type ? { ...t, assigned: assign } : t)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending((current) => current.filter((t) => t !== type));
    }
  };

  if (!types) {
    return error ? (
      <Alert variant="danger">{error}</Alert>
    ) : (
      <div className="admin-loading">
        <Spinner animation="border" size="sm" /> Loading types...
      </div>
    );
  }

  const assigned = types.filter((t) => t.assigned).length;
  const needle = filter.trim().toLowerCase();
  const visible = types.filter(
    (t) =>
      (scope === "all" || t.assigned === (scope === "assigned")) &&
      (!needle || t.identifier.toLowerCase().includes(needle) || t.name?.toLowerCase().includes(needle)),
  );

  return (
    <div>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      <p className="text-muted small">
        The types assigned to the space are offered when instances are created in it.
      </p>
      <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
        <Form.Control
          size="sm"
          type="search"
          className="admin-filter"
          placeholder="Filter types..."
          aria-label="Filter types"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Form.Select
          size="sm"
          className="admin-scope"
          aria-label="Show"
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
        >
          <option value="all">All types ({types.length})</option>
          <option value="assigned">Assigned ({assigned})</option>
          <option value="unassigned">Not assigned ({types.length - assigned})</option>
        </Form.Select>
        <span className="admin-result-count ms-auto">
          {assigned} of {types.length} assigned
        </span>
      </div>
      {types.length === 0 && <p className="admin-empty">There are no types yet.</p>}
      {types.length > 0 && visible.length === 0 && <p className="admin-empty">No types match the filter.</p>}
      {visible.length > 0 && (
        <ul className="admin-type-list list-unstyled mb-0">
          {visible.map((type) => {
            const id = `admin-space-type-${type.identifier}`;
            const name = type.name || shortName(type.identifier);
            return (
              <li key={type.identifier} className="admin-type-row">
                <Form.Check
                  type="switch"
                  id={id}
                  className="mb-0"
                  aria-label={`Assign ${name}`}
                  disabled={pending.includes(type.identifier)}
                  checked={type.assigned}
                  onChange={(e) => toggle(type.identifier, e.target.checked)}
                />
                <label htmlFor={id} className="admin-type-text">
                  <span className="admin-type-name">
                    <span className="admin-type-dot" style={{ backgroundColor: type.color || "#6c757d" }} aria-hidden />
                    {name}
                  </span>
                  <span className="admin-identifier">{type.identifier}</span>
                </label>
                <span className="admin-type-occurrences">
                  {type.occurrences} {type.occurrences === 1 ? "instance" : "instances"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
