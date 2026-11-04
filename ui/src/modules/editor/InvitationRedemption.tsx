import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Spinner } from "react-bootstrap";
import { useAuth } from "../../contexts/AuthContext";
import { redeemInvitation } from "../../services/invitations";

/**
 * The page an invitation link opens: The user is signed in already (the whole app requires it - an existing session
 * is reused), so the invitation is accepted right away and the instance it was issued for is opened in the editor.
 */
export default function InvitationRedemption() {
  const { token } = useParams<{ token: string }>();
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    getAccessToken()
      .then((accessToken) => redeemInvitation(accessToken, token))
      .then((instanceId) => {
        if (!cancelled) {
          // The invitation page is used up - going back shouldn't open it again
          navigate(`/editor/instances/${encodeURIComponent(instanceId)}`, { replace: true });
        }
      })
      .catch((e: unknown) => {
        console.error("Failed to accept the invitation", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, navigate, token]);

  return (
    <div className="d-flex flex-column justify-content-center align-items-center h-100 gap-3 p-4 text-center">
      {!token || error ? (
        <Alert variant="danger" className="mb-0" style={{ maxWidth: 520 }}>
          <p className="fw-semibold mb-2">The invitation could not be accepted.</p>
          <p className="mb-2">
            The link may be incomplete, already used, revoked or expired. Ask the person who invited you for a new link.
          </p>
          {error && <p className="small mb-2">{error}</p>}
          <Link to="/editor">Go to the editor</Link>
        </Alert>
      ) : (
        <>
          <Spinner animation="border" role="status" />
          <span>Accepting the invitation...</span>
        </>
      )}
    </div>
  );
}
