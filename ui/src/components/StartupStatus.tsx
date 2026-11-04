import React from "react";
import { Alert, Button, Spinner } from "react-bootstrap";

interface StartupStatusProps {
  message?: string;
  error?: string;
  onRetry?: () => void;
}

/** Full page placeholder shown while the application is bootstrapping (config, login). */
export default function StartupStatus({ message, error, onRetry }: StartupStatusProps) {
  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100 gap-3">
      {error ? (
        <Alert variant="danger" className="text-center">
          <p className="mb-2">{error}</p>
          {onRetry && (
            <Button variant="outline-danger" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </Alert>
      ) : (
        <>
          <Spinner animation="border" role="status" />
          {message && <span>{message}</span>}
        </>
      )}
    </div>
  );
}
