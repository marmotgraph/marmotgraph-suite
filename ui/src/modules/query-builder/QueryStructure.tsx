import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDown,
  faArrowUp,
  faAsterisk,
  faChevronDown,
  faChevronRight,
  faCircle,
  faLevelDownAlt,
  faLongArrowAltLeft,
  faLongArrowAltRight,
  faSort,
  faTrashAlt,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import {
  defaultAlias,
  fieldProblem,
  propertyLabel,
  QueryField,
  typeName,
  TypesById,
} from "./queryModel";

/** The types a link reaches - unknown types (only found in the query) are marked as such. */
export function TypeTags({ types, identifiers }: { types: TypesById; identifiers: string[] }) {
  if (!identifiers.length) {
    return null;
  }
  return (
    <span className="query-type-tags">
      {identifiers.map((identifier) => {
        const type = types.get(identifier);
        return (
          <span
            key={identifier}
            className={`query-type-tag${type ? "" : " is-unknown"}`}
            title={type ? identifier : `${identifier} (unknown type)`}
          >
            <FontAwesomeIcon icon={faCircle} className="query-type-dot" style={{ color: type?.color || "#6c757d" }} />
            {typeName(types, identifier)}
          </span>
        );
      })}
    </span>
  );
}

interface FieldRowProps {
  field: QueryField;
  parent?: QueryField;
  index: number;
  types: TypesById;
  selectedKey: string;
  onSelect: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  onRemove: (key: string) => void;
}

function FieldNode({ field, parent, index, types, selectedKey, onSelect, onMove, onRemove }: FieldRowProps) {
  const [expanded, setExpanded] = useState(true);
  const isRoot = !parent;
  const problem = fieldProblem(field, isRoot);
  const hasChildren = field.children.length > 0;
  const label = isRoot
    ? typeName(types, field.schema.identifier)
    : field.schema.identifier
      ? propertyLabel(field.schema)
      : "(no path)";
  const showAlias = !isRoot && !parent?.isFlattened;
  const alias = field.alias?.trim();
  const siblings = parent?.children.length ?? 0;
  const stop = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
  };

  return (
    <li role="treeitem" aria-selected={field.key === selectedKey} aria-expanded={hasChildren ? expanded : undefined}>
      <div
        className={`query-tree-row${field.key === selectedKey ? " is-selected" : ""}${problem ? " has-problem" : ""}`}
        tabIndex={0}
        onClick={() => onSelect(field.key)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelect(field.key);
          }
        }}
        title={isRoot ? field.schema.identifier : field.schema.identifier || undefined}
      >
        {hasChildren ? (
          <Button
            variant="link"
            className="query-tree-toggle"
            onClick={stop(() => setExpanded(!expanded))}
            aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          >
            <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} />
          </Button>
        ) : (
          <span className="query-tree-toggle-spacer" />
        )}
        {isRoot ? (
          <FontAwesomeIcon
            icon={faCircle}
            className="query-tree-icon"
            style={{ color: types.get(field.schema.identifier)?.color || "#6c757d" }}
          />
        ) : (
          <FontAwesomeIcon
            icon={field.schema.reverse ? faLongArrowAltLeft : faLongArrowAltRight}
            className={`query-tree-icon${field.schema.reverse ? " query-tree-icon--reverse" : ""}`}
            title={field.schema.reverse ? "Incoming link (followed in reverse)" : undefined}
          />
        )}
        <span className="query-tree-main">
          <span className="query-tree-label">{label}</span>
          {showAlias && (
            <span className={`query-tree-alias${alias ? " is-custom" : ""}`} title="Name in the result">
              [{alias || defaultAlias(field)}]
            </span>
          )}
          {!isRoot && <TypeTags types={types} identifiers={field.typeFilter ?? field.schema.targetTypes} />}
          {!!field.options.required && !parent?.isFlattened && (
            <span className="query-tree-flag" title="Required">
              <FontAwesomeIcon icon={faAsterisk} />
              <span className="visually-hidden">Required</span>
            </span>
          )}
          {!!field.options.sort && (
            <span className="query-tree-flag" title="Sorts the result">
              <FontAwesomeIcon icon={faSort} />
              <span className="visually-hidden">Sorts the result</span>
            </span>
          )}
          {field.isFlattened && hasChildren && (
            <span className="query-tree-flag" title="Flattened">
              <FontAwesomeIcon icon={faLevelDownAlt} flip="horizontal" />
              <span className="visually-hidden">Flattened</span>
            </span>
          )}
        </span>
        {problem && (
          <span className="query-tree-warning" title={problem}>
            <FontAwesomeIcon icon={faTriangleExclamation} />
            <span className="visually-hidden">{problem}</span>
          </span>
        )}
        {!isRoot && (
          <span className="query-tree-actions">
            <Button
              variant="link"
              className="edit-icon-btn"
              disabled={index === 0}
              onClick={stop(() => onMove(field.key, -1))}
              aria-label={`Move ${label} up`}
              title="Move up"
            >
              <FontAwesomeIcon icon={faArrowUp} />
            </Button>
            <Button
              variant="link"
              className="edit-icon-btn"
              disabled={index >= siblings - 1}
              onClick={stop(() => onMove(field.key, 1))}
              aria-label={`Move ${label} down`}
              title="Move down"
            >
              <FontAwesomeIcon icon={faArrowDown} />
            </Button>
            <Button
              variant="link"
              className="edit-icon-btn"
              onClick={stop(() => onRemove(field.key))}
              aria-label={`Remove ${label}`}
              title="Remove"
            >
              <FontAwesomeIcon icon={faTrashAlt} />
            </Button>
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <ul className="query-tree" role="group">
          {field.children.map((child, i) => (
            <FieldNode
              key={child.key}
              field={child}
              parent={field}
              index={i}
              types={types}
              selectedKey={selectedKey}
              onSelect={onSelect}
              onMove={onMove}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The fields of the query as a tree - the selected field is the one whose options and properties are shown. */
export default function QueryStructure(props: Omit<FieldRowProps, "field" | "parent" | "index"> & { root: QueryField }) {
  const { root, ...rest } = props;
  return (
    <ul className="query-tree" role="tree" aria-label="Fields of the query">
      <FieldNode field={root} index={0} {...rest} />
    </ul>
  );
}
