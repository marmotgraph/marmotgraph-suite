import React, { useMemo, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { Globe, Plus } from "lucide-react";
import { RoleDefinition } from "../../services/permissions";
import { useSpaces } from "../../hooks/useSpaces";
import { useSubNavActions } from "../../contexts/SubNavActionsContext";
import { AddClaimModal, ClaimDraft, GLOBAL, newClaimDraft, RoleClaimsList, useRoleDefinitions } from "./RoleClaims";

/**
 * The overview of all claims mapped to the roles of the core - grouped by space (with the global roles first) and
 * role. Claims are added as JSON patterns and removed one by one. The claims of a single space are managed along with
 * the space as well.
 */
export default function PermissionsAdmin() {
  const { roles, definitions, error, setError, busy, update, removeClaim } = useRoleDefinitions();
  const spaces = useSpaces();
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<ClaimDraft>();

  /** The role definitions grouped by space - global first (even without definitions), then the spaces by name. */
  const sections = useMemo(() => {
    if (!definitions) {
      return [];
    }
    const grouped = new Map<string, RoleDefinition[]>([[GLOBAL, []]]);
    definitions.forEach((d) => {
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

  const openDraft = (space: string) => setDraft(newClaimDraft(space, roles[0] ?? ""));

  useSubNavActions([{ label: "Add claim", icon: <Plus size={16} />, onClick: () => openDraft(GLOBAL) }]);

  const save = async ({ space, role }: ClaimDraft, claim: Record<string, unknown>) => {
    if (await update(role, space.trim(), claim, false)) {
      setDraft(undefined);
    }
  };

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
            {sections.length} {sections.length === 1 ? "group" : "groups"}
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

      {definitions && sections.length === 0 && <p className="admin-empty">No permissions match the filter.</p>}

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
              <RoleClaimsList
                roleDefinitions={roleDefinitions}
                emptyText={space === GLOBAL ? "No global claims are defined." : "No claims are defined for this space."}
                busy={busy}
                onRemove={removeClaim}
              />
            </div>
          </section>
        );
      })}

      <AddClaimModal
        draft={draft}
        roles={roles}
        spaces={spaces.map((s) => s.identifier)}
        busy={busy}
        onChange={setDraft}
        onHide={() => setDraft(undefined)}
        onSave={save}
      />
    </div>
  );
}
