import React, { useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faLongArrowAltLeft, faPlus } from "@fortawesome/free-solid-svg-icons";
import type { QueryProperty } from "../../services/queries";
import { availableProperties } from "./propertyGroups";
import { lookupTypes, propertyLabel, QueryField, typeName, TypesById } from "./queryModel";
import { TypeTags } from "./QueryStructure";

function PropertyList({
  title,
  type,
  properties,
  types,
  onAdd,
}: {
  title: string;
  /** The type the properties are specific to */
  type?: string;
  properties: QueryProperty[];
  types: TypesById;
  onAdd: (property: QueryProperty, keepSelection: boolean) => void;
}) {
  if (!properties.length) {
    return null;
  }
  return (
    <section className="query-add-group">
      <h6 className="query-add-group-title">
        {title}
        {type && (
          <>
            <FontAwesomeIcon icon={faCircle} className="query-type-dot" style={{ color: types.get(type)?.color || "#6c757d" }} />
            <span title={type}>{typeName(types, type)}</span>
          </>
        )}
        <span className="query-add-group-count">{properties.length}</span>
      </h6>
      <ul className="query-add-list">
        {properties.map((property) => {
          const label = propertyLabel(property);
          return (
            <li key={`${property.identifier}${property.reverse ? " reverse" : ""}`} className="query-add-item">
              <Button
                variant="link"
                className="edit-icon-btn"
                onClick={(e) => onAdd(property, e.ctrlKey || e.metaKey)}
                aria-label={`Add ${label}${property.reverse ? " (incoming link)" : ""}`}
                title="Add to the query (Ctrl / Cmd + click to keep the current field selected)"
              >
                <FontAwesomeIcon icon={faPlus} />
              </Button>
              <div className="query-add-item-body">
                <span className="query-add-item-label">
                  {property.reverse && (
                    <FontAwesomeIcon
                      icon={faLongArrowAltLeft}
                      className="query-tree-icon--reverse me-2"
                      title="Incoming link (followed in reverse)"
                    />
                  )}
                  {label}
                </span>
                <TypeTags types={types} identifiers={property.targetTypes} />
                <span className="query-add-item-id" title={property.identifier}>
                  {property.identifier}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Offers the properties of the types the selected field reaches - to add them as child fields. */
export default function AddProperties({
  field,
  types,
  onAdd,
}: {
  field: QueryField;
  types: TypesById;
  onAdd: (property: QueryProperty, keepSelection: boolean) => void;
}) {
  const [filter, setFilter] = useState("");
  const [includeAdvanced, setIncludeAdvanced] = useState(false);
  const lookups = lookupTypes(field);
  const available = useMemo(
    () => availableProperties(types, lookups, filter, includeAdvanced),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [types, lookups.join("\n"), filter, includeAdvanced],
  );

  if (field.isFlattened) {
    return <div className="query-status-message">A flattened field returns the values of its only child field.</div>;
  }
  if (!lookups.length) {
    return (
      <div className="query-status-message">
        {field.schema.targetTypes.length
          ? "Select at least one type to restrict to."
          : "Attributes have no fields of their own. Select a link or the root to add fields."}
      </div>
    );
  }

  return (
    <>
      <div className="query-add-filter">
        <Form.Control
          size="sm"
          type="search"
          placeholder="Filter properties"
          aria-label="Filter properties"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Form.Check
          id="query-advanced-properties"
          type="checkbox"
          label="Show advanced properties"
          checked={includeAdvanced}
          onChange={(e) => setIncludeAdvanced(e.target.checked)}
        />
      </div>
      {available.count === 0 ? (
        <div className="query-status-message">
          {filter ? `No properties match "${filter}".` : "These types have no known properties yet."}
        </div>
      ) : (
        <>
          <PropertyList title="Attributes" properties={available.commonAttributes} types={types} onAdd={onAdd} />
          {available.attributesByType.map((group) => (
            <PropertyList
              key={`a-${group.type}`}
              title="Attributes of"
              type={group.type}
              properties={group.properties}
              types={types}
              onAdd={onAdd}
            />
          ))}
          <PropertyList title="Links" properties={available.commonLinks} types={types} onAdd={onAdd} />
          {available.linksByType.map((group) => (
            <PropertyList
              key={`l-${group.type}`}
              title="Links of"
              type={group.type}
              properties={group.properties}
              types={types}
              onAdd={onAdd}
            />
          ))}
        </>
      )}
    </>
  );
}
