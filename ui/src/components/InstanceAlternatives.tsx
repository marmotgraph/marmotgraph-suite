import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTurnUp, faUsers } from "@fortawesome/free-solid-svg-icons";
import InstanceFieldControl from "./InstanceFieldControl";
import { LinkIdentifiersOnlyContext } from "./LinkedInstancesField";
import { FieldAlternative, InstanceField } from "../services/instances";
import { InstanceFieldValues, isInstanceFieldValueEqual } from "../modules/editor/editorMockData";
import "./InstanceAlternatives.css";

const noChange = () => undefined;
const noInstanceClick = () => undefined;

/** Shows or hides the values contributed to a field - it tells how many there are if they differ. */
function AlternativesToggle({
  subject,
  count,
  expanded,
  onClick,
}: {
  subject: string;
  count: number;
  expanded: boolean;
  onClick: () => void;
}) {
  const label = `Contributions to ${subject}${count > 1 ? ` (${count} different values)` : ""}`;
  return (
    <Button
      type="button"
      variant="link"
      className={`edit-icon-btn instance-alternatives-toggle${expanded ? " edit-icon-btn--active" : ""}`}
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={faUsers} />
      {count > 1 && <span className="instance-alternatives-toggle-count">{count}</span>}
    </Button>
  );
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === "";
}

/** The value a user contributed - shown the same way as the value of the field, except for links: they show their identifier. */
function AlternativeValue({ field, alternative }: { field: InstanceField; alternative: FieldAlternative }) {
  if (alternative.text !== undefined) {
    return <div className="view-value">{alternative.text}</div>;
  }
  if (isEmpty(alternative.value)) {
    return <em className="text-muted">No value</em>;
  }
  return (
    <LinkIdentifiersOnlyContext.Provider value={true}>
      <InstanceFieldControl
        field={field}
        value={alternative.value}
        onChange={noChange}
        isEditMode={false}
        onInstanceClick={noInstanceClick}
      />
    </LinkIdentifiersOnlyContext.Provider>
  );
}

/** Whether the contribution can be taken over - it has to be a value in the shape of a field which can be edited. */
function canCopy(field: InstanceField, alternative: FieldAlternative) {
  return !field.readOnly && alternative.text === undefined && !isEmpty(alternative.value);
}

/** Copies a contributed value into the field - it tells if the field holds the value already. */
function CopyToFieldButton({ isInField, onClick }: { isInField: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="link"
      className="edit-icon-btn instance-alternative-copy"
      disabled={isInField}
      onClick={onClick}
    >
      {isInField ? (
        "In field"
      ) : (
        <>
          <FontAwesomeIcon icon={faTurnUp} aria-hidden="true" /> Copy to field
        </>
      )}
    </Button>
  );
}

/** The values contributed to a field: who has defined which value, and which of them is the current one. */
function AlternativesPanel({
  field,
  alternatives,
  value,
  onCopy,
}: {
  field: InstanceField;
  alternatives: FieldAlternative[];
  /** The value in the field right now (it may not be saved yet) */
  value: unknown;
  onCopy: (value: unknown) => void;
}) {
  return (
    <div className="instance-field-panel" role="group" aria-label={`Contributions to ${field.label}`}>
      <p className="instance-field-panel-title">Contributions</p>
      {!alternatives.some((alternative) => alternative.selected) && (
        <p className="instance-alternatives-note">The latest contribution removed the value of this field.</p>
      )}
      <ul className="instance-alternatives-list">
        {alternatives.map((alternative, index) => (
          <li key={index} className="instance-alternative">
            <div className="instance-alternative-content">
              <div className="instance-alternative-value">
                <AlternativeValue field={field} alternative={alternative} />
              </div>
              <div className="instance-alternative-meta">
                {alternative.selected && (
                  <span className="instance-alternative-current">
                    <FontAwesomeIcon icon={faCheck} aria-hidden="true" /> Current
                  </span>
                )}
                <span className="instance-alternative-users">
                  {alternative.users.length > 0
                    ? alternative.users.map((user) => user.name).join(", ")
                    : "Unknown contributor"}
                </span>
              </div>
            </div>
            {canCopy(field, alternative) && (
              <CopyToFieldButton
                isInField={isInstanceFieldValueEqual(alternative.value, value)}
                onClick={() => onCopy(alternative.value)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type FieldAlternativesControls = {
  /** The control showing or hiding the contributions to the field - nothing if there are none */
  toggle: (field: InstanceField) => React.ReactNode;
  /** The contributions to the field - nothing if they are hidden */
  panel: (field: InstanceField) => React.ReactNode;
};

/** The contributions to the fields of an instance - shown on demand, per field. */
export function useFieldAlternatives(
  alternatives: Record<string, FieldAlternative[]> | undefined,
  values: InstanceFieldValues,
  onCopy: (identifier: string, value: unknown) => void,
): FieldAlternativesControls {
  const [openFields, setOpenFields] = useState<ReadonlySet<string>>(new Set());

  const toggleField = (identifier: string) =>
    setOpenFields((open) => {
      const next = new Set(open);
      if (!next.delete(identifier)) {
        next.add(identifier);
      }
      return next;
    });

  return {
    toggle: (field) => {
      const count = alternatives?.[field.identifier]?.length ?? 0;
      return count > 0 ? (
        <AlternativesToggle
          subject={field.label}
          count={count}
          expanded={openFields.has(field.identifier)}
          onClick={() => toggleField(field.identifier)}
        />
      ) : null;
    },
    panel: (field) => {
      const fieldAlternatives = alternatives?.[field.identifier];
      return fieldAlternatives && openFields.has(field.identifier) ? (
        <AlternativesPanel
          field={field}
          alternatives={fieldAlternatives}
          value={values[field.identifier]}
          onCopy={(value) => onCopy(field.identifier, value)}
        />
      ) : null;
    },
  };
}
