import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { openSignInWindow, SignInTokens } from "../services/embedding";

/** Asks the user to sign in while the suite is embedded in an iframe. Whatever is shown behind it stays untouched. */
export default function EmbeddedSignIn({ onSignedIn }: { onSignedIn: (tokens: SignInTokens) => void }) {
  const [blocked, setBlocked] = useState(false);
  const stopListening = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => stopListening.current?.(), []);

  const signIn = () => {
    stopListening.current?.();
    stopListening.current = openSignInWindow(onSignedIn);
    setBlocked(!stopListening.current);
  };

  return (
    <Modal show centered backdrop="static" keyboard={false}>
      <Modal.Header>
        <Modal.Title>Sign in to continue</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0">The sign-in opens in a separate window and brings you back here.</p>
        {blocked && (
          <Alert variant="danger" className="mt-3 mb-0">
            The browser blocked the window. Allow pop-ups for this page and try again.
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="dark" onClick={signIn}>
          Sign in
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
