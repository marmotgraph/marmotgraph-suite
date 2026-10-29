import React, { useMemo, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDown,
  faArrowUp,
  faCircle,
  faPlus,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../contexts/AuthContext";
import { useTypes } from "../hooks/useTypes";
import { EmbeddedInstance, InstanceField } from "../services/instances";
import { fetchTypeFields, typeLabel } from "../services/types";
import type { InstanceFieldControlProps } from "./InstanceFieldControl";
import "./NestedInstancesField.css";

type NestedInstancesFieldProps = InstanceFieldControlProps & {
  /** Whether the field holds a single embedded instance (SINGLE_NESTED) instead of a list of them (NESTED) */
  single: boolean;
  /** Shows the fields of the embedded instances - passed in since the nested fields are shown by it as well */
  FieldControl: React.ComponentType<InstanceFieldControlProps>;
};

function asEmbeddedInstances(value: unknown): EmbeddedInstance[] {
  if (Array.isArray(value)) {
    return value as EmbeddedInstance[];
  }
  return value ? [value as EmbeddedInstance] : [];
}

function RequiredMark() {
  return (
    <span className="instance-field-required text-danger" title="Required">
      <span aria-hidden="true"> *</span>
      <span className="visually-hidden"> required</span>
    </span>
  );
}

/** Whether the field has no value - such fields are not shown when not editing. */
function isEmpty(field: InstanceField): boolean {
  const { value } = field;
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * The instances embedded in a nested field - each is shown in a subsection with the fields of its type. New ones are
 * added with the (empty) fields of the chosen type, as loaded from the backend.
 */
export default function NestedInstancesField({
  field,
  value,
  onChange,
  isEditMode,
  single,
  FieldControl,
  ...fieldControlProps
}: NestedInstancesFieldProps) {
  const { getAccessToken } = useAuth();
  const types = useTypes();
  const [addingType, setAddingType] = useState<string>();
  const [addError, setAddError] = useState<string>();

  const instances = asEmbeddedInstances(value);

  const emit = (changed: EmbeddedInstance[]) =>
    onChange(single ? (changed[0] ?? null) : changed);

  /** The types new instances can be embedded with - named by the types known to the core */
  const targetTypes = useMemo(
    () =>
      (field.targetTypes ?? []).map((identifier) => {
        const type = types.find((t) => t.identifier === identifier) ?? {
          identifier,
        };
        return {
          identifier,
          label: typeLabel(type),
          color: type.color,
        };
      }),
    [field.targetTypes, types],
  );

  const setFieldValue = (index: number, identifier: string, fieldValue: unknown) =>
    emit(
      instances.map((instance, i) =>
        i !== index
          ? instance
          : {
              ...instance,
              fields: instance.fields.map((f) =>
                f.identifier === identifier ? { ...f, value: fieldValue } : f,
              ),
            },
      ),
    );

  const remove = (index: number) =>
    emit(instances.filter((_, i) => i !== index));

  const move = (index: number, offset: number) => {
    const moved = [...instances];
    const [instance] = moved.splice(index, 1);
    moved.splice(index + offset, 0, instance);
    emit(moved);
  };

  const add = (type: (typeof targetTypes)[number]) => {
    setAddingType(type.identifier);
    setAddError(undefined);
    getAccessToken()
      .then((token) => fetchTypeFields(token, type.identifier))
      .then((fields) =>
        emit([
          ...instances,
          {
            type: type.identifier,
            typeLabel: type.label,
            typeColor: type.color,
            fields,
          },
        ]),
      )
      .catch((e: unknown) => {
        console.error("Failed to load the fields of the type", e);
        setAddError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setAddingType(undefined));
  };

  if (!isEditMode && instances.length === 0) {
    return (
      <div className="view-value">
        <em className="text-muted">No value</em>
      </div>
    );
  }

  const canAdd = isEditMode && (!single || instances.length === 0);

  return (
    <div
      className={`nested-instances-field${isEditMode ? " nested-instances-field--edit" : ""}`}
    >
      {instances.map((instance, index) => {
        const fields = isEditMode
          ? instance.fields
          : instance.fields.filter((f) => !isEmpty(f));
        return (
          <section
            key={index}
            className="nested-instance"
            style={{ borderLeftColor: instance.typeColor || "#6c757d" }}
            aria-label={`${field.label}: ${instance.typeLabel}${single ? "" : ` ${index + 1}`}`}
          >
            <div className="nested-instance-header">
              <span className="nested-instance-type">
                <FontAwesomeIcon
                  icon={faCircle}
                  className="nested-instance-type-dot"
                  style={{ color: instance.typeColor || "#6c757d" }}
                />
                {instance.typeLabel}
                {!single && instances.length > 1 && (
                  <span className="nested-instance-index">#{index + 1}</span>
                )}
              </span>
              {isEditMode && (
                <span className="nested-instance-actions">
                  {!single && index > 0 && (
                    <Button
                      variant="link"
                      size="sm"
                      className="edit-icon-btn nested-instance-action"
                      aria-label="Move up"
                      title="Move up"
                      onClick={() => move(index, -1)}
                    >
                      <FontAwesomeIcon icon={faArrowUp} />
                    </Button>
                  )}
                  {!single && index < instances.length - 1 && (
                    <Button
                      variant="link"
                      size="sm"
                      className="edit-icon-btn nested-instance-action"
                      aria-label="Move down"
                      title="Move down"
                      onClick={() => move(index, 1)}
                    >
                      <FontAwesomeIcon icon={faArrowDown} />
                    </Button>
                  )}
                  <Button
                    variant="link"
                    size="sm"
                    className="edit-icon-btn nested-instance-action"
                    aria-label={`Remove ${instance.typeLabel}`}
                    title="Remove"
                    onClick={() => remove(index)}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </Button>
                </span>
              )}
            </div>
            {fields.length === 0 ? (
              <p className="nested-instance-empty text-muted">
                {isEditMode ? "This type has no fields." : "No values."}
              </p>
            ) : (
              fields.map((nestedField) => (
                <div key={nestedField.identifier} className="nested-instance-field">
                  {isEditMode ? (
                    <Form.Label title={nestedField.tooltip}>
                      {nestedField.label}
                      {nestedField.required && <RequiredMark />}
                    </Form.Label>
                  ) : (
                    <div className="view-label" title={nestedField.tooltip}>
                      {nestedField.label}
                      {nestedField.required && <RequiredMark />}
                    </div>
                  )}
                  <FieldControl
                    {...fieldControlProps}
                    field={nestedField}
                    value={nestedField.value ?? null}
                    onChange={(v) => setFieldValue(index, nestedField.identifier, v)}
                    isEditMode={isEditMode}
                  />
                </div>
              ))
            )}
          </section>
        );
      })}

      {isEditMode && instances.length === 0 && (
        <p className="nested-instances-empty text-muted">No value</p>
      )}

      {canAdd && targetTypes.length > 0 && (
        <div className="nested-instances-add">
          {targetTypes.map((type) => (
            <Button
              key={type.identifier}
              variant="outline-secondary"
              size="sm"
              disabled={addingType !== undefined}
              onClick={() => add(type)}
            >
              {addingType === type.identifier ? (
                <Spinner animation="border" size="sm" className="me-2" />
              ) : (
                <FontAwesomeIcon icon={faPlus} className="me-2" />
              )}
              Add {type.label}
            </Button>
          ))}
        </div>
      )}
      {addError && (
        <Alert variant="danger" className="mt-2 mb-0 py-2">
          The fields of the type could not be loaded: {addError}
        </Alert>
      )}
    </div>
  );
}
