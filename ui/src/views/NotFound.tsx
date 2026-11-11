import React from "react";
import { Link } from "react-router-dom";

/**
 * The page for client side routes that don't exist - the counterpart of the 404 page of the service
 * (service/src/main/resources/static/error/404.html), which answers the paths the service resolves itself (e.g. /docs).
 */
export default function NotFound() {
  return (
    <div className="layout-not-found">
      <p className="layout-not-found-kicker">Error 404</p>
      <h1 className="layout-not-found-title">Page not found</h1>
      <p className="layout-not-found-text">The page you were looking for doesn't exist or has been moved.</p>
      <div className="layout-not-found-actions">
        {/* A link styled as the dark page action - it navigates, so it keeps the role of a link */}
        <Link className="btn btn-dark btn-sm" to="/">
          Go to the suite
        </Link>
        <Link className="layout-not-found-link" to="/documentation">
          Open the documentation
        </Link>
      </div>
    </div>
  );
}
