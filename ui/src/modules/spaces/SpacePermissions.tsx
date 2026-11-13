import React from "react";
import { Alert, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { definitionsOf, RoleClaimsList, useRoleDefinitions } from "../admin/RoleClaims";

/** The claims mapped to the roles in the space - read only, they are managed in the permissions of the admin module. */
export default function SpacePermissions({ space }: { space: string }) {
  const { definitions, error, setError } = useRoleDefinitions();

  return (
    <div>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      <p className="text-muted small">
        The users matching the claims of a role are granted the role in the space. The claims are managed in the{" "}
        <Link to="/admin/permissions" className="admin-link">
          permissions
        </Link>
        .
      </p>
      {!definitions && !error && (
        <div className="admin-loading">
          <Spinner animation="border" size="sm" /> Loading permissions...
        </div>
      )}
      {definitions && (
        <section className="admin-space-card">
          <div className="admin-space-body">
            <RoleClaimsList
              roleDefinitions={definitionsOf(definitions, space)}
              emptyText="No claims are defined for this space."
            />
          </div>
        </section>
      )}
    </div>
  );
}
