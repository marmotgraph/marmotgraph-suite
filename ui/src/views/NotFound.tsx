import React from "react";
import { Link } from "react-router-dom";
import ProblemMessage from "../components/ProblemMessage";

/**
 * The page for client side routes that don't exist - the counterpart of the 404 page of the service
 * (service/src/main/resources/static/error/404.html), which answers the paths the service resolves itself (e.g. /docs).
 */
export default function NotFound() {
  return (
    <ProblemMessage
      illustration="lost"
      kicker="Error 404"
      title="Page not found"
      actions={
        <>
          {/* A link styled as the dark page action - it navigates, so it keeps the role of a link */}
          <Link className="btn btn-dark btn-sm" to="/">
            Go to the suite
          </Link>
          <Link className="layout-not-found-link" to="/documentation">
            Open the documentation
          </Link>
        </>
      }
    >
      The page you were looking for doesn't exist or has been moved.
    </ProblemMessage>
  );
}
