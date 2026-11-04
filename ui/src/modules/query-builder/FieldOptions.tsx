import React from "react";
import { Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle } from "@fortawesome/free-solid-svg-icons";
import {
  defaultAlias,
  FILTER_OPERATIONS,
  FilterOption,
  isFlattenedToRoot,
  isLink,
  propertyLabel,
  QueryField,
  QueryModel,
  RESERVED_PARAMETERS,
  SINGLE_VALUE_STRATEGIES,
  typeFilterOptions,
  typeName,
  TypesById,
} from "./queryModel";
import type { QueryFilterOperation } from "../../services/queries";

interface FieldOptionsProps {
  model: QueryModel;
  /** The fields from the root to the selected one */
  path: QueryField[];
  types: TypesById;
  readOnly: boolean;
  onChangeModel: (change: Partial<QueryModel>) => void;
  onChangeField: (update: (field: QueryField) => QueryField) => void;
  onSetOption: (name: string, value: unknown) => void;
}

function Check({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="query-option">
      <Form.Check
        id={id}
        type="checkbox"
        label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {hint && <div className="query-option-hint ms-4">{hint}</div>}
    </div>
  );
}

/** The settings of the query (shown while the root is selected) */
function QueryOptions({ model, readOnly, onChangeModel }: Pick<FieldOptionsProps, "model" | "readOnly" | "onChangeModel">) {
  return (
    <>
      <Form.Group className="query-option" controlId="query-title">
        <Form.Label>Title</Form.Label>
        <Form.Control
          size="sm"
          value={model.label}
          disabled={readOnly}
          placeholder="Untitled query"
          onChange={(e) => onChangeModel({ label: e.target.value })}
        />
      </Form.Group>
      <Form.Group className="query-option" controlId="query-description">
        <Form.Label>Description</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          size="sm"
          value={model.description}
          disabled={readOnly}
          onChange={(e) => onChangeModel({ description: e.target.value })}
        />
      </Form.Group>
    </>
  );
}

function FilterOptions({ filter, onChange }: { filter?: FilterOption; onChange: (filter?: FilterOption) => void }) {
  const op = filter?.op ?? "";
  const parameter = filter?.parameter?.trim();
  return (
    <div className="query-option">
      <div className="query-option-label">Filter</div>
      <div className="query-filter-row">
        <Form.Select
          size="sm"
          aria-label="Filter operation"
          value={op}
          onChange={(e) =>
            onChange(e.target.value ? { ...filter, op: e.target.value as QueryFilterOperation } : undefined)
          }
        >
          <option value="">No filter</option>
          {FILTER_OPERATIONS.map((operation) => (
            <option key={operation.value} value={operation.value}>
              {operation.label}
            </option>
          ))}
        </Form.Select>
        {op && op !== "IS_EMPTY" && (
          <>
            <Form.Control
              size="sm"
              aria-label="Filter value"
              placeholder="Value"
              value={filter?.value ?? ""}
              onChange={(e) => onChange({ ...filter, value: e.target.value || undefined })}
            />
            <Form.Control
              size="sm"
              aria-label="Filter parameter"
              placeholder="Parameter name"
              value={filter?.parameter ?? ""}
              onChange={(e) => onChange({ ...filter, parameter: e.target.value || undefined })}
            />
          </>
        )}
      </div>
      {op && op !== "IS_EMPTY" && (
        <div className="query-option-hint">
          A parameter lets the value be provided when the query is run - the value given here is the default.
        </div>
      )}
      {parameter && RESERVED_PARAMETERS.includes(parameter) && (
        <div className="query-option-warning" role="alert">
          &quot;{parameter}&quot; is a reserved parameter name and can&apos;t be used.
        </div>
      )}
    </div>
  );
}

function TypeFilterOptions({
  field,
  types,
  onChange,
}: {
  field: QueryField;
  types: TypesById;
  onChange: (typeFilter?: string[]) => void;
}) {
  const options = typeFilterOptions(field);
  if (!options.length) {
    return null;
  }
  const enabled = field.typeFilter !== undefined;
  const toggle = (identifier: string, selected: boolean) => {
    const current = field.typeFilter ?? [];
    onChange(selected ? [...current, identifier] : current.filter((t) => t !== identifier));
  };
  return (
    <div className="query-option">
      <Form.Check
        id={`type-filter-${field.key}`}
        type="checkbox"
        label="Restrict to type(s)"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked ? [...field.schema.targetTypes] : undefined)}
      />
      {enabled && (
        <div className="query-type-filter-list">
          {options.map((option) => (
            <Form.Check
              key={option.identifier}
              id={`type-filter-${field.key}-${option.identifier}`}
              type="checkbox"
              checked={option.selected}
              onChange={(e) => toggle(option.identifier, e.target.checked)}
              label={
                <span title={option.identifier}>
                  <FontAwesomeIcon
                    icon={faCircle}
                    className="query-type-dot me-2"
                    style={{ color: types.get(option.identifier)?.color || "#6c757d" }}
                  />
                  {typeName(types, option.identifier)}
                  {option.isUnknown && <span className="query-option-hint ms-2">(unknown type)</span>}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** The options of the selected field - only the ones which apply to it in its position are offered. */
export default function FieldOptions(props: FieldOptionsProps) {
  const { model, path, types, readOnly, onChangeModel, onChangeField, onSetOption } = props;
  const field = path.at(-1);
  if (!field) {
    return null;
  }
  const parent = path.at(-2);
  if (!parent) {
    return <QueryOptions model={model} readOnly={readOnly} onChangeModel={onChangeModel} />;
  }

  const link = isLink(field);
  const parentFlattened = parent.isFlattened;
  const flag = (name: string) => !!field.options[name];
  const setFlag = (name: string) => (checked: boolean) => onSetOption(name, checked ? true : undefined);

  return (
    <>
      {!parentFlattened && (
        <Form.Group className="query-option" controlId={`alias-${field.key}`}>
          <Form.Label>Name in the result</Form.Label>
          <Form.Control
            size="sm"
            value={field.alias ?? ""}
            placeholder={defaultAlias(field)}
            onChange={(e) => onChangeField((f) => ({ ...f, alias: e.target.value || undefined }))}
          />
        </Form.Group>
      )}
      {!parentFlattened && (
        <Check
          id={`required-${field.key}`}
          label="Required"
          hint="Only instances with a value for this field are returned"
          checked={flag("required")}
          onChange={setFlag("required")}
        />
      )}
      {!link && isFlattenedToRoot(path) && (
        <Check
          id={`sort-${field.key}`}
          label="Sort the result by this field"
          hint="Only one field of the query can sort the result"
          checked={flag("sort")}
          onChange={setFlag("sort")}
        />
      )}
      {link && !parentFlattened && !field.schema.reverse && (
        <Check
          id={`ensure-order-${field.key}`}
          label="Ensure original order"
          hint="Returns the links in the order they were entered, including duplicates"
          checked={flag("ensureOrder")}
          onChange={setFlag("ensureOrder")}
        />
      )}
      {link && field.children.length === 1 && (
        <Check
          id={`flatten-${field.key}`}
          label="Flatten"
          hint={`Returns the values of "${propertyLabel(field.children[0].schema)}" directly instead of nested objects`}
          checked={field.isFlattened}
          onChange={(isFlattened) => onChangeField((f) => ({ ...f, isFlattened }))}
        />
      )}
      {link && !parentFlattened && (
        <Form.Group className="query-option" controlId={`single-value-${field.key}`}>
          <Form.Label>Single item strategy</Form.Label>
          <Form.Select
            size="sm"
            value={(field.options.singleValue as string | undefined) ?? ""}
            onChange={(e) => onSetOption("singleValue", e.target.value || undefined)}
          >
            <option value="">None - always return a list</option>
            {SINGLE_VALUE_STRATEGIES.map((strategy) => (
              <option key={strategy} value={strategy}>
                {strategy === "FIRST" ? "First - only the first item" : "Concat - all items joined"}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      )}
      {!link && (
        <FilterOptions
          filter={field.options.filter as FilterOption | undefined}
          onChange={(filter) => onSetOption("filter", filter)}
        />
      )}
      <TypeFilterOptions
        field={field}
        types={types}
        onChange={(typeFilter) => onChangeField((f) => ({ ...f, typeFilter }))}
      />
    </>
  );
}
