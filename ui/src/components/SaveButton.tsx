import React, { useEffect, useState } from "react";
import { Button, Spinner } from "react-bootstrap";

/** A save button which reports that the save was successful for a moment. */
export default function SaveButton({ disabled, onSave }: { disabled: boolean; onSave: () => Promise<boolean> }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (state !== "saved") {
      return;
    }
    const timeout = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timeout);
  }, [state]);

  const save = async () => {
    setState("saving");
    setState((await onSave()) ? "saved" : "idle");
  };

  return (
    <Button variant="outline-dark" size="sm" disabled={disabled || state === "saving"} onClick={save}>
      {state === "saving" ? <Spinner animation="border" size="sm" /> : state === "saved" ? "Saved" : "Save"}
    </Button>
  );
}
