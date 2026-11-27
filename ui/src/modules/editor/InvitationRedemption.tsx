import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { useAuth } from "../../contexts/AuthContext";
import { redeemInvitation } from "../../services/invitations";
import { HttpError } from "../../services/http";
import ProblemMessage, { illustrationForStatus } from "../../components/ProblemMessage";

/**
 * The page an invitation link opens: The user is signed in already (the whole app requires it - an existing session
 * is reused), so the invitation is accepted right away and the instance it was issued for is opened in the editor.
 */
export default function InvitationRedemption() {
  const { token } = useParams<{ token: string }>();
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [errorStatus, setErrorStatus] = useState<number>();

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
          setErrorStatus(e instanceof HttpError ? e.status : undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, navigate, token]);

  return (
    <div className="d-flex flex-column justify-content-center align-items-center h-100 gap-3 p-4 text-center">
      {!token || error ? (
        <ProblemMessage
          // Without token, the link is incomplete - as refused (4xx) as a used, revoked or expired one
          illustration={token ? illustrationForStatus(errorStatus) : "refused"}
          kicker={errorStatus ? `Error ${errorStatus}` : token ? "Error" : "Invalid link"}
          title="The invitation could not be accepted"
          actions={
            // A link styled as the dark page action - it navigates, so it keeps the role of a link
            <Link className="btn btn-dark btn-sm" to="/editor">
              Go to the editor
            </Link>
          }
        >
          <p>
            The link may be incomplete, already used, revoked or expired. Ask the person who invited you for a new link.
          </p>
          {error && <p>{error}</p>}
        </ProblemMessage>
      ) : (
        <>
          <Spinner animation="border" role="status" />
          <span>Accepting the invitation...</span>
        </>
      )}
    </div>
  );
}
