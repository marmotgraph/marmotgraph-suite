import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { Globe, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSubNavActions } from "../../contexts/SubNavActionsContext";
import { useSpaces } from "../../hooks/useSpaces";
import {
  Claims,
  fetchRoleDefinitions,
  fetchRoles,
  individualClaims,
  RoleDefinition,
  updateRoleDefinition,
} from "../../services/permissions";

/** The key of the section of the global role definitions */
const GLOBAL = "";

interface ClaimDraft {
  space: string;
  role: string;
  json: string;
}

/**
 * Manages the claims mapped to the roles of the core - grouped by space (with the global roles first) and role. Claims
 * are added as JSON patterns and removed one by one.
 */
export default function PermissionsAdmin() {
  const { getAccessToken } = useAuth();
  const spaces = useSpaces();
  const [roles, setRoles] = useState<string[]>([]);
  const [definitions, setDefinitions] = useState<RoleDefinition[]>();
  const [error, setError] = useState<string>();
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<ClaimDraft>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(undefined);
    getAccessToken()
      .then((token) => Promise.all([fetchRoles(token), fetchRoleDefinitions(token)]))
      .then(([r, d]) => {
        setRoles(r);
        setDefinitions(d);
      })
      .catch((e: Error) => setError(e.message));
  }, [getAccessToken]);

  useEffect(load, [load]);

  /** The role definitions grouped by space - global first, then the spaces by name. */
  const sections = useMemo(() => {
    const grouped = new Map<string, RoleDefinition[]>();
    (definitions ?? []).forEach((d) => {
      const key = d.space ?? GLOBAL;
      grouped.set(key, [...(grouped.get(key) ?? []), d]);
    });
    const term = filter.trim().toLowerCase();
    return [...grouped.entries()]
      .filter(([space, roleDefinitions]) =>
        !term ||
        (space || "global").toLowerCase().includes(term) ||
        roleDefinitions.some((d) => JSON.stringify(d.claims).toLowerCase().includes(term)),
      )
      .sort(([a], [b]) => (a === GLOBAL ? -1 : b === GLOBAL ? 1 : a.localeCompare(b)));
  }, [definitions, filter]);

  /** Takes over the definition of a role as returned by the core after an update (dropping it if nothing remains). */
  const apply = (updated: RoleDefinition) => {
    setDefinitions((current) => {
      const others = (current ?? []).filter(
        (d) => !((d.space ?? GLOBAL) === (updated.space ?? GLOBAL) && d.role === updated.role),
      );
      if (Object.keys(updated.claims ?? {}).length === 0) {
        return others;
      }
      const result = [...others, updated];
      return result.sort(
        (a, b) =>
          (a.space ?? GLOBAL).localeCompare(b.space ?? GLOBAL) ||
          roles.indexOf(a.role) - roles.indexOf(b.role),
      );
    });
  };

  const update = async (role: string, space: string, claim: Claims, remove: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      const token = await getAccessToken();
      apply(await updateRoleDefinition(token, role, space || null, claim, remove));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const removeClaim = (definition: RoleDefinition, claim: Claims) => {
    const where = definition.space ? `in the space "${definition.space}"` : "globally";
    if (window.confirm(`Remove the claim ${JSON.stringify(claim)} from the role "${definition.role}" ${where}?`)) {
      void update(definition.role, definition.space ?? GLOBAL, claim, true);
    }
  };

  const draftClaim = useMemo(() => parseClaim(draft?.json), [draft?.json]);

  const saveDraft = async () => {
    if (draft && draftClaim.claim && (await update(draft.role, draft.space.trim(), draftClaim.claim, false))) {
      setDraft(undefined);
    }
  };

  const openDraft = (space: string, role?: string) =>
    setDraft({ space, role: role ?? roles[0] ?? "", json: '{\n  "roles": {\n    "group": [""]\n  }\n}' });

  useSubNavActions([{ label: "Add claim", icon: <Plus size={16} />, onClick: () => openDraft(GLOBAL) }]);

  return (
    <div>
      <div className="d-flex align-items-center flex-wrap mb-3 gap-2">
        <Form.Control
          size="sm"
          type="search"
          className="admin-filter"
          placeholder="Filter by space or claim..."
          aria-label="Filter by space or claim"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {definitions && (
          <span className="admin-result-count ms-auto">
            {sections.length} {sections.length === 1 ? "space" : "spaces"}
          </span>
        )}
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}

      {!definitions && !error && (
        <div className="admin-loading">
          <Spinner animation="border" size="sm" /> Loading permissions...
        </div>
      )}

      {definitions && sections.length === 0 && (
        <p className="admin-empty">{filter ? "No permissions match the filter." : "No permissions are defined yet."}</p>
      )}

      {sections.map(([space, roleDefinitions]) => {
        const spaceLabel = space === GLOBAL ? "Global" : space;
        return (
          <section key={space || "global"} className="admin-space-card">
            <div className="admin-space-header">
              {space === GLOBAL && <Globe size={16} aria-hidden />}
              <span>{spaceLabel}</span>
              <Button
                size="sm"
                variant="link"
                className="ms-auto edit-icon-btn admin-icon-btn"
                title={`Add claim (${spaceLabel})`}
                aria-label={`Add claim (${spaceLabel})`}
                onClick={() => openDraft(space)}
              >
                <Plus size={16} />
              </Button>
            </div>
            <div className="admin-space-body">
              {roleDefinitions.map((definition) => (
                <div key={definition.role} className="admin-role">
                  <div className="d-flex align-items-center">
                    <span className="admin-kicker">{definition.role}</span>
                    <Button
                      size="sm"
                      variant="link"
                      className="ms-auto edit-icon-btn admin-icon-btn"
                      title={`Add claim to ${definition.role}`}
                      aria-label={`Add claim to ${definition.role}`}
                      onClick={() => openDraft(space, definition.role)}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                  <ul className="list-unstyled mb-0">
                    {individualClaims(definition.claims).map((claim) => {
                      const json = JSON.stringify(claim);
                      return (
                        <li key={json} className="admin-claim d-flex align-items-center">
                          <code className="flex-grow-1">{json}</code>
                          <Button
                            size="sm"
                            variant="link"
                            className="ms-2 edit-icon-btn admin-icon-btn"
                            title="Remove this claim"
                            aria-label={`Remove the claim ${json} from ${definition.role}`}
                            disabled={busy}
                            onClick={() => removeClaim(definition, claim)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <Modal show={!!draft} onHide={() => setDraft(undefined)} centered className="admin-modal">
        <Modal.Header closeButton>
          <Modal.Title>Add claim</Modal.Title>
        </Modal.Header>
        {draft && (
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Space</Form.Label>
              <Form.Control
                size="sm"
                list="admin-spaces"
                placeholder="Leave empty for a global role"
                value={draft.space}
                onChange={(e) => setDraft({ ...draft, space: e.target.value })}
              />
              <datalist id="admin-spaces">
                {spaces.map((s) => (
                  <option key={s.identifier} value={s.identifier}>
                    {s.name}
                  </option>
                ))}
              </datalist>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select size="sm" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Claim (JSON)</Form.Label>
              <Form.Control
                as="textarea"
                rows={8}
                className="admin-code"
                value={draft.json}
                isInvalid={!!draftClaim.error}
                onChange={(e) => setDraft({ ...draft, json: e.target.value })}
              />
              <Form.Control.Feedback type="invalid">{draftClaim.error}</Form.Control.Feedback>
              <Form.Text muted>
                The pattern is matched against the claims of the token of a user - e.g.{" "}
                <code>{'{"roles": {"group": ["my-group"]}}'}</code>. It is merged with the existing claims of the role.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
        )}
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDraft(undefined)}>
            Cancel
          </Button>
          <Button variant="dark" disabled={busy || !draftClaim.claim || !draft?.role} onClick={saveDraft}>
            {busy ? <Spinner animation="border" size="sm" /> : "Add"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

/** Parses the JSON of a claim - it has to be a non-empty object. */
function parseClaim(json: string | undefined): { claim?: Claims; error?: string } {
  if (!json?.trim()) {
    return { error: "The claim is required" };
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { error: "The claim has to be a JSON object" };
    }
    if (Object.keys(parsed).length === 0) {
      return { error: "The claim must not be empty" };
    }
    return { claim: parsed as Claims };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
