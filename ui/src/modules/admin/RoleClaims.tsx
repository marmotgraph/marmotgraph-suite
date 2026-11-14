import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  Claims,
  fetchRoleDefinitions,
  fetchRoles,
  individualClaims,
  RoleDefinition,
  updateRoleDefinition,
} from "../../services/permissions";

/** The key of the global role definitions */
export const GLOBAL = "";

/** The global functionalities required to see (and modify) the claims of the roles in the core. */
export const PERMISSION_FUNCTIONALITIES = ["CREATE_PERMISSION", "DELETE_PERMISSION"];

/** If the claims of the roles can be managed with the given global functionalities. */
export function canManagePermissions(functionalities: string[] | undefined): boolean {
  return !!functionalities?.some((f) => PERMISSION_FUNCTIONALITIES.includes(f));
}

/** Loads the roles of the core and the claims mapped to them - and keeps them up to date when they are modified. */
export function useRoleDefinitions() {
  const { getAccessToken } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [definitions, setDefinitions] = useState<RoleDefinition[]>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAccessToken()
      .then((token) => Promise.all([fetchRoles(token), fetchRoleDefinitions(token)]))
      .then(([r, d]) => {
        setRoles(r);
        setDefinitions(d);
      })
      .catch((e: Error) => setError(e.message));
  }, [getAccessToken]);

  /** Takes over the definition of a role as returned by the core after an update (dropping it if nothing remains). */
  const apply = useCallback(
    (updated: RoleDefinition) =>
      setDefinitions((current) => {
        const others = (current ?? []).filter(
          (d) => !((d.space ?? GLOBAL) === (updated.space ?? GLOBAL) && d.role === updated.role),
        );
        if (Object.keys(updated.claims ?? {}).length === 0) {
          return others;
        }
        return [...others, updated].sort(
          (a, b) => (a.space ?? GLOBAL).localeCompare(b.space ?? GLOBAL) || roles.indexOf(a.role) - roles.indexOf(b.role),
        );
      }),
    [roles],
  );

  /** Adds the claim to the role of the space (or removes it) - reports whether it succeeded. */
  const update = async (role: string, space: string, claim: Claims, remove: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      apply(await updateRoleDefinition(await getAccessToken(), role, space || null, claim, remove));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Removes the claim from the role after the confirmation of the user. */
  const removeClaim = (definition: RoleDefinition, claim: Claims) => {
    const where = definition.space ? `in the space "${definition.space}"` : "globally";
    if (window.confirm(`Remove the claim ${JSON.stringify(claim)} from the role "${definition.role}" ${where}?`)) {
      void update(definition.role, definition.space ?? GLOBAL, claim, true);
    }
  };

  return { roles, definitions, error, setError, busy, update, removeClaim };
}

/** The role definitions of the space (global if it is {@link GLOBAL}). */
export function definitionsOf(definitions: RoleDefinition[] | undefined, space: string): RoleDefinition[] {
  return (definitions ?? []).filter((d) => (d.space ?? GLOBAL) === space);
}

/** The claims of the roles in one space - each claim can be removed on its own (read only without onRemove). */
export function RoleClaimsList({ roleDefinitions, emptyText, busy = false, onRemove }: Readonly<{
  roleDefinitions: RoleDefinition[];
  emptyText: string;
  busy?: boolean;
  onRemove?: (definition: RoleDefinition, claim: Claims) => void;
}>) {
  if (roleDefinitions.length === 0) {
    return <p className="admin-space-empty">{emptyText}</p>;
  }
  return (
    <>
      {roleDefinitions.map((definition) => (
        <div key={definition.role} className="admin-role">
          <div className="admin-kicker">{definition.role}</div>
          <ul className="list-unstyled mb-0">
            {individualClaims(definition.claims).map((claim) => {
              const json = JSON.stringify(claim);
              return (
                <li key={json} className="admin-claim d-flex align-items-center">
                  <code className="flex-grow-1">{json}</code>
                  {onRemove && (
                    <Button
                      size="sm"
                      variant="link"
                      className="ms-2 edit-icon-btn admin-icon-btn"
                      title="Remove this claim"
                      aria-label={`Remove the claim ${json} from ${definition.role}`}
                      disabled={busy}
                      onClick={() => onRemove(definition, claim)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

/** A claim which is about to be added to a role. */
export interface ClaimDraft {
  space: string;
  role: string;
  json: string;
}

export function newClaimDraft(space: string, role: string): ClaimDraft {
  return { space, role, json: '{\n  "roles": {\n    "group": [""]\n  }\n}' };
}

/**
 * Asks for a claim to add to a role.
 *
 * @param spaces the spaces to suggest - the space can't be changed if they are not given
 */
export function AddClaimModal({ draft, roles, spaces, busy, onChange, onHide, onSave }: Readonly<{
  draft?: ClaimDraft;
  roles: string[];
  spaces?: string[];
  busy: boolean;
  onChange: (draft: ClaimDraft) => void;
  onHide: () => void;
  onSave: (draft: ClaimDraft, claim: Claims) => void;
}>) {
  const parsed = useMemo(() => parseClaim(draft?.json), [draft?.json]);

  return (
    <Modal show={!!draft} onHide={onHide} centered className="admin-modal">
      <Modal.Header closeButton>
        <Modal.Title>{draft && !spaces ? `Add claim (${draft.space || "Global"})` : "Add claim"}</Modal.Title>
      </Modal.Header>
      {draft && (
        <Modal.Body>
          {spaces && (
            <Form.Group className="mb-3" controlId="admin-claim-space">
              <Form.Label>Space</Form.Label>
              <Form.Control
                size="sm"
                list="admin-spaces"
                placeholder="Leave empty for a global role"
                value={draft.space}
                onChange={(e) => onChange({ ...draft, space: e.target.value })}
              />
              <datalist id="admin-spaces">
                {spaces.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Form.Group>
          )}
          <Form.Group className="mb-3" controlId="admin-claim-role">
            <Form.Label>Role</Form.Label>
            <Form.Select size="sm" value={draft.role} onChange={(e) => onChange({ ...draft, role: e.target.value })}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="admin-claim-json">
            <Form.Label>Claim (JSON)</Form.Label>
            <Form.Control
              as="textarea"
              rows={8}
              className="admin-code"
              value={draft.json}
              isInvalid={!!parsed.error}
              onChange={(e) => onChange({ ...draft, json: e.target.value })}
            />
            <Form.Control.Feedback type="invalid">{parsed.error}</Form.Control.Feedback>
            <Form.Text muted>
              The pattern is matched against the claims of the token of a user - e.g.{" "}
              <code>{'{"roles": {"group": ["my-group"]}}'}</code>. It is merged with the existing claims of the role.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
      )}
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="dark"
          disabled={busy || !parsed.claim || !draft?.role}
          onClick={() => draft && parsed.claim && onSave(draft, parsed.claim)}
        >
          {busy ? <Spinner animation="border" size="sm" /> : "Add"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

/** Parses the JSON of a claim - it has to be a non-empty object. */
export function parseClaim(json: string | undefined): { claim?: Claims; error?: string } {
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
