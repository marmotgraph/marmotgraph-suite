import React, { useId, useState } from "react";
import { Button, Collapse, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp, faCopy, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import "./InstanceIdentifiers.css";

/**
 * The identifiers of an instance - shown apart from its fields since each of them identifies the instance. They can
 * only be added: the stored ones stay, only the ones added (and not saved yet) can be taken back. They are collapsed
 * by default - unless there are unsaved ones (e.g. of a draft), which are not to go unnoticed.
 */
export default function InstanceIdentifiers({
  identifiers,
  saved,
  isEditMode,
  onChange,
}: {
  /** The identifiers as currently edited */
  identifiers: string[];
  /** The identifiers as stored */
  saved: string[];
  isEditMode: boolean;
  onChange: (identifiers: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const titleId = useId();
  const contentId = useId();
  const candidate = draft.trim();
  const duplicate = identifiers.includes(candidate);
  const isChanged = identifiers.length !== saved.length;
  const [isExpanded, setIsExpanded] = useState(isEditMode && isChanged);

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

  return (
    <section className="instance-identifiers" aria-labelledby={titleId}>
      <div className="instance-identifiers-header">
        <h3 id={titleId} className="instance-identifiers-title">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="instance-identifiers-toggle p-0"
            onClick={() => setIsExpanded((previous) => !previous)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
          >
            Identifiers <span className="instance-identifiers-count">({identifiers.length})</span>
            <FontAwesomeIcon
              icon={isExpanded ? faChevronUp : faChevronDown}
              className="ms-2 instance-identifiers-toggle-icon"
              aria-hidden="true"
            />
          </Button>
        </h3>
        {isEditMode && isChanged && <span className="instance-field-label-changed-badge">Unsaved</span>}
      </div>
      <Collapse in={isExpanded}>
        <div id={contentId}>
          {identifiers.length === 0 ? (
            <p className="instance-identifiers-empty">This instance has no identifiers yet.</p>
          ) : (
            <ul className="instance-identifiers-list">
              {identifiers.map((identifier) => {
                const added = !saved.includes(identifier);
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
                  </li>
                );
              })}
            </ul>
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
                  : "Identifiers can be added but not removed once they are saved."}
              </Form.Text>
            </div>
          )}
        </div>
      </Collapse>
    </section>
  );
}
