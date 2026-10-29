import React, { useLayoutEffect, useRef, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { ArrowRight, GripVertical, Layers, Pencil, Trash2 } from "lucide-react";
import {
  describeWidget,
  ModelProperty,
  ModelType,
  propertyName,
  SpecificationSource,
  widgetKind,
} from "../../services/modeler";
import TypeIdentifier from "./TypeIdentifier";
import WidgetPreview from "./WidgetPreview";

/** Moves the item at the index to the target index (the index it has after the move). */
function moved<T>(items: T[], from: number, to: number): T[] {
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

/**
 * The properties of a type as the editor shows them in its form - each with an example of its widget. They can be
 * dragged (or moved with the arrow keys on their handle) to change their order.
 */
export default function PropertyFields({
  properties,
  types,
  sources,
  canDefine,
  saving,
  onReorder,
  onEdit,
  onRemove,
  renderBadges,
  renderLinks,
}: {
  properties: ModelProperty[];
  types: ModelType[];
  /** Where the specifications of the properties come from - undefined while they are checked */
  sources?: Record<string, SpecificationSource>;
  canDefine: boolean;
  /** If a change of the order is being saved - the order can't be changed meanwhile */
  saving: boolean;
  onReorder: (properties: ModelProperty[]) => void;
  onEdit: (property: ModelProperty) => void;
  onRemove: (property: ModelProperty) => void;
  /** The badges telling where the specification of the property comes from */
  renderBadges: (property: ModelProperty) => React.ReactNode;
  /** The links to the target types of the property */
  renderLinks: (property: ModelProperty) => React.ReactNode;
}) {
  const [dragged, setDragged] = useState<string>();
  // The index the dragged property is inserted at (before the property at the index)
  const [dropIndex, setDropIndex] = useState<number>();
  const [announcement, setAnnouncement] = useState("");
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const [focus, setFocus] = useState<string>();
  const sortable = canDefine && !saving;

  // Moving the property in the DOM loses the focus of its handle - it's given back after the move
  useLayoutEffect(() => {
    if (focus) {
      handles.current.get(focus)?.focus();
      setFocus(undefined);
    }
  }, [focus, properties]);

  const endDrag = () => {
    setDragged(undefined);
    setDropIndex(undefined);
  };

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= properties.length) {
      return;
    }
    const property = properties[from];
    onReorder(moved(properties, from, to));
    setAnnouncement(`${propertyName(property)} moved to position ${to + 1} of ${properties.length}.`);
  };

  const drop = () => {
    const from = properties.findIndex((p) => p.identifier === dragged);
    if (from >= 0 && dropIndex !== undefined) {
      // The property is removed from its position first
      move(from, dropIndex > from ? dropIndex - 1 : dropIndex);
    }
    endDrag();
  };

  return (
    <div
      className="instance-form modeler-fields"
      onDragOver={(e) => dragged && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        drop();
      }}
    >
      {properties.map((property, index) => {
        const name = propertyName(property);
        const known = widgetKind(property.widget);
        const classes = ["modeler-field"];
        if (sources?.[property.identifier] === "NONE") classes.push("modeler-field--unspecified");
        if (sortable) classes.push("modeler-field--sortable");
        if (dragged === property.identifier) classes.push("modeler-field--dragged");
        if (dragged && dropIndex === index) classes.push("modeler-field--drop-before");
        if (dragged && dropIndex === properties.length && index === properties.length - 1) {
          classes.push("modeler-field--drop-after");
        }
        return (
          <div
            key={property.identifier}
            className={classes.join(" ")}
            data-testid="modeler-field"
            draggable={sortable}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              // Firefox only starts dragging with data
              e.dataTransfer.setData("text/plain", property.identifier);
              setDragged(property.identifier);
            }}
            onDragOver={(e) => {
              if (!dragged) {
                return;
              }
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              const rect = e.currentTarget.getBoundingClientRect();
              setDropIndex(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
            }}
            onDragEnd={endDrag}
          >
            {canDefine && (
              <button
                type="button"
                className="modeler-field-handle"
                ref={(element) => {
                  if (element) handles.current.set(property.identifier, element);
                  else handles.current.delete(property.identifier);
                }}
                aria-disabled={saving}
                aria-label={`Move ${name} (position ${index + 1} of ${properties.length})`}
                aria-describedby="modeler-fields-help"
                title="Drag to change the order"
                onKeyDown={(e) => {
                  const to = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : undefined;
                  if (to !== undefined && !saving) {
                    e.preventDefault();
                    setFocus(property.identifier);
                    move(index, to);
                  }
                }}
              >
                <GripVertical size={16} aria-hidden />
              </button>
            )}
            <div className="modeler-field-body">
              <div className="modeler-field-header">
                <Form.Label as="div" className="modeler-field-label" title={property.identifier}>
                  {name}
                  {property.required && <span title="Required"> *</span>}
                </Form.Label>
                {renderBadges(property)}
                <span className="modeler-field-tools">
                  <span className="modeler-status" title={property.widget ? `Widget: ${property.widget}` : "No widget specified"}>
                    {known?.kind.holds === "links" && <ArrowRight size={12} aria-hidden />}
                    {known?.kind.holds === "embedded" && <Layers size={12} aria-hidden />}
                    {describeWidget(property.widget)}
                  </span>
                  {canDefine && (
                    <>
                      <Button
                        size="sm"
                        variant="link"
                        className="edit-icon-btn"
                        title="Edit"
                        aria-label={`Edit ${name}`}
                        onClick={() => onEdit(property)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="link"
                        className="edit-icon-btn"
                        title="Remove the definition for this type (properties used by instances remain visible)"
                        aria-label={`Remove ${name}`}
                        onClick={() => onRemove(property)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                </span>
              </div>
              <WidgetPreview widget={property.widget} targetTypes={property.targetTypes} types={types} />
              <div className="modeler-field-meta">
                <TypeIdentifier identifier={property.identifier} />
                <span className="modeler-num text-nowrap">
                  Used by {property.occurrences ?? 0} {property.occurrences === 1 ? "instance" : "instances"}
                </span>
                {property.targetTypes.length > 0 && (
                  <span className="d-inline-flex flex-wrap align-items-center gap-2">
                    {known?.kind.holds === "embedded" ? "Embeds" : "Links to"}
                    {renderLinks(property)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {canDefine && (
        <>
          <p id="modeler-fields-help" className="visually-hidden">
            Drag the properties or use the arrow keys on their handle to change the order they are shown in.
          </p>
          <div className="visually-hidden" aria-live="polite">
            {announcement}
          </div>
        </>
      )}
    </div>
  );
}
