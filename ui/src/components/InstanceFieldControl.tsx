import React from "react";
import { Form } from "react-bootstrap";
import LinkedInstancesField from "./LinkedInstancesField";
import { LinkedInstance } from "../modules/editor/editorMockData";
import { FieldKind, InstanceField } from "../services/instances";
import { typeLabel } from "../services/types";

export type InstanceFieldControlProps = {
  field: InstanceField;
  value: unknown;
  onChange: (value: unknown) => void;
  isEditMode: boolean;
  onInstanceClick: (instanceId: string) => void;
  currentInstanceId?: string;
  parentSpace?: string;
  /** The id of the linked instance to highlight */
  highlightedInstanceId?: string;
  /** Called with the id of the linked instance hovered (undefined when left) */
  onInstanceHover?: (instanceId: string | undefined) => void;
};

function asText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function asLinkedInstances(value: unknown): LinkedInstance[] {
  if (Array.isArray(value)) {
    return value as LinkedInstance[];
  }
  return value ? [value as LinkedInstance] : [];
}

/** A text based input - shows the plain value when not editing. */
function textInput(type: string, toInputValue: (text: string) => string = (text) => text) {
  return function TextInput({ value, onChange, isEditMode }: InstanceFieldControlProps) {
    if (!isEditMode) {
      return <div className="view-value">{asText(value)}</div>;
    }
    return (
      <Form.Control
        type={type}
        className={type === "color" ? "form-control-color" : undefined}
        value={toInputValue(asText(value))}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  };
}

function TextArea({ value, onChange, isEditMode }: InstanceFieldControlProps) {
  if (!isEditMode) {
    return <div className="view-value" style={{ whiteSpace: "pre-wrap" }}>{asText(value)}</div>;
  }
  return (
    <Form.Control
      as="textarea"
      rows={3}
      value={asText(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function NumberInput({ value, onChange, isEditMode }: InstanceFieldControlProps) {
  if (!isEditMode) {
    return <div className="view-value">{asText(value)}</div>;
  }
  return (
    <Form.Control
      type="number"
      value={asText(value)}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  );
}

function CheckBox({ value, onChange, isEditMode }: InstanceFieldControlProps) {
  return (
    <Form.Check
      type="checkbox"
      checked={value === true}
      disabled={!isEditMode}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

/** Links to instances - a single link (LINK) is handled as a list of at most one. */
function linkedInstances(single: boolean) {
  return function LinkedInstances({
    field,
    value,
    onChange,
    isEditMode,
    onInstanceClick,
    currentInstanceId,
    parentSpace,
    highlightedInstanceId,
    onInstanceHover,
  }: InstanceFieldControlProps) {
    const allowedTypes = (field.targetTypes ?? []).map((identifier) => typeLabel({ identifier }));
    return (
      <LinkedInstancesField
        fieldLabel={field.label}
        allowedTypes={allowedTypes}
        linkedInstances={asLinkedInstances(value)}
        onInstanceClick={onInstanceClick}
        isEditMode={isEditMode}
        onChange={
          isEditMode
            ? (instances) => onChange(single ? (instances.at(-1) ?? null) : instances)
            : undefined
        }
        currentInstanceId={currentInstanceId}
        parentSpace={parentSpace}
        variant={isEditMode ? "edit" : "view"}
        highlightedInstanceId={highlightedInstanceId}
        onInstanceHover={onInstanceHover}
      />
    );
  };
}

function UnsupportedField({ value }: InstanceFieldControlProps) {
  return (
    <div className="view-value text-muted">
      {value === null || value === undefined ? (
        <em>No value</em>
      ) : (
        <code>{JSON.stringify(value)}</code>
      )}
      <div className="small">This kind of field is not supported (yet).</div>
    </div>
  );
}

/** The component showing a field by the kind of the field provided by the backend. */
const fieldControls: Record<FieldKind, React.ComponentType<InstanceFieldControlProps>> = {
  TEXT: textInput("text"),
  TEXTAREA: TextArea,
  NUMBER: NumberInput,
  DATE: textInput("date"),
  // datetime-local inputs do not accept seconds / time zones
  DATETIME: textInput("datetime-local", (text) => text.substring(0, 16)),
  TIME: textInput("time"),
  COLOR: textInput("color"),
  CHECKBOX: CheckBox,
  LINK: linkedInstances(true),
  LINKS: linkedInstances(false),
  UNSUPPORTED: UnsupportedField,
};

export default function InstanceFieldControl(props: InstanceFieldControlProps) {
  const Control = fieldControls[props.field.kind] ?? UnsupportedField;
  // Read only fields (and unsupported ones) are never edited
  const isEditMode = props.isEditMode && !props.field.readOnly && props.field.kind !== "UNSUPPORTED";
  return <Control {...props} isEditMode={isEditMode} />;
}
