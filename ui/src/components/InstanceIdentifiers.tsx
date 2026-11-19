import React, { useId, useState } from "react";
import { Button, Form, Spinner } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faPlus, faTrashCan, faXmark } from "@fortawesome/free-solid-svg-icons";
import InstanceHeaderSection from "./InstanceHeaderSection";
import "./InstanceIdentifiers.css";

/**
 * The identifiers of an instance - shown apart from its fields since each of them identifies the instance. The added
 * ones are saved with the fields (and can be taken back until then). The stored ones are removed right away, after
 * confirmation - the core refuses it if a relation targets the identifier. The ones representing the id of the
 * instance stay. They are collapsed by default - unless there are unsaved ones (e.g. of a draft), which are not to go
 * unnoticed.
 */
export default function InstanceIdentifiers({
  instanceId,
  identifiers,
  saved,
  isEditMode,
  onChange,
  onRemove,
}: {
  instanceId: string;
  /** The identifiers as currently edited */
  identifiers: string[];
  /** The identifiers as stored */
  saved: string[];
  isEditMode: boolean;
  onChange: (identifiers: string[]) => void;
  /** Removes a stored identifier - not offered without it (e.g. for a new instance) */
  onRemove?: (identifier: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  /** The stored identifier whose removal is to be confirmed */
  const [confirming, setConfirming] = useState<string>();
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string>();
  const inputId = useId();
  const candidate = draft.trim();
  const duplicate = identifiers.includes(candidate);
  const isChanged = identifiers.length !== saved.length;

  // Nothing to show - the section is only needed to add identifiers
  if (!isEditMode && identifiers.length === 0) {
    return null;
  }

  const add = () => {
    if (!candidate || duplicate) {
      return;
    }
    onChange([...identifiers, candidate]);
    setDraft("");
  };

  const remove = (identifier: string) => {
    if (!onRemove) {
      return;
    }
    setRemoving(true);
    setRemoveError(undefined);
    onRemove(identifier)
      .then(() => setConfirming(undefined))
      .catch((e: unknown) => setRemoveError(e instanceof Error ? e.message : String(e)))
      .finally(() => setRemoving(false));
  };

  return (
    <InstanceHeaderSection
      title="Identifiers"
      count={<span className="instance-header-section-count">({identifiers.length})</span>}
      summary={isEditMode && isChanged && <span className="instance-field-label-changed-badge">Unsaved</span>}
      defaultExpanded={isEditMode && isChanged}
    >
      {identifiers.length === 0 ? (
        <p className="instance-identifiers-empty">This instance has no identifiers yet.</p>
      ) : (
        <ul className="instance-identifiers-list">
          {identifiers.map((identifier) => {
            const added = !saved.includes(identifier);
            const removable = isEditMode && !added && onRemove !== undefined && !identifier.endsWith(instanceId);
            if (removable && confirming === identifier) {
              return (
                <li key={identifier} className="instance-identifier instance-identifier--removing">
                  <span className="instance-identifier-value" title={identifier}>
                    {identifier}
                  </span>
                  <span className="instance-identifier-confirm">Remove permanently?</span>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    className="instance-identifier-confirm-btn"
                    disabled={removing}
                    onClick={() => {
                      setConfirming(undefined);
                      setRemoveError(undefined);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="instance-identifier-confirm-btn"
                    disabled={removing}
                    onClick={() => remove(identifier)}
                    aria-label={`Remove identifier ${identifier}`}
                  >
                    {removing && <Spinner animation="border" size="sm" className="me-1" aria-hidden="true" />}
                    Remove
                  </Button>
                </li>
              );
            }
            return (
              <li
                key={identifier}
                className={`instance-identifier${isEditMode && added ? " instance-identifier--added" : ""}`}
              >
                <span className="instance-identifier-value" title={identifier}>
                  {identifier}
                </span>
                {isEditMode && added && <span className="instance-identifier-new">New</span>}
                <Button
                  variant="link"
                  size="sm"
                  className="edit-icon-btn instance-identifier-action"
                  onClick={() => navigator.clipboard.writeText(identifier)}
                  aria-label={`Copy identifier ${identifier}`}
                  title="Copy identifier"
                >
                  <FontAwesomeIcon icon={faCopy} />
                </Button>
                {isEditMode && added && (
                  <Button
                    variant="link"
                    size="sm"
                    className="edit-icon-btn instance-identifier-action"
                    onClick={() => onChange(identifiers.filter((i) => i !== identifier))}
                    aria-label={`Remove the new identifier ${identifier}`}
                    title="Remove (not saved yet)"
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </Button>
                )}
                {removable && (
                  <Button
                    variant="link"
                    size="sm"
                    className="edit-icon-btn instance-identifier-action"
                    disabled={removing}
                    onClick={() => {
                      setConfirming(identifier);
                      setRemoveError(undefined);
                    }}
                    aria-label={`Remove identifier ${identifier}`}
                    title="Remove identifier"
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {removeError && (
        <p className="instance-identifiers-error" role="alert">
          {removeError}
        </p>
      )}
      {isEditMode && (
        <div className="instance-identifiers-add">
          <Form.Label htmlFor={inputId} className="visually-hidden">
            New identifier
          </Form.Label>
          <div className="instance-identifiers-add-row">
            <Form.Control
              id={inputId}
              size="sm"
              value={draft}
              placeholder="Add an identifier"
              isInvalid={duplicate}
              aria-describedby={`${inputId}-help`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline-secondary"
              onClick={add}
              disabled={!candidate || duplicate}
            >
              <FontAwesomeIcon icon={faPlus} className="me-1" aria-hidden="true" />
              Add identifier
            </Button>
          </div>
          <Form.Text id={`${inputId}-help`} className={duplicate ? "text-danger" : "instance-identifiers-help"}>
            {duplicate
              ? "The instance already has this identifier."
              : "New identifiers are kept when the instance is saved. Removing a stored one applies right away - unless it is in use by a link."}
          </Form.Text>
        </div>
      )}
    </InstanceHeaderSection>
  );
}
