import React from "react";
import { Badge, Button, Form, Table } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faPlus } from "@fortawesome/free-solid-svg-icons";
import { ModelType, shortName, typeName, UNSUPPORTED_WIDGETS, widgetKind } from "../../services/modeler";
import "../editor/InstanceDetail.css";
import "../../components/LinkedInstancesField.css";
import "../../components/NestedInstancesField.css";

const FALLBACK_COLOR = "#6c757d";

/** A target type of a property as shown in the examples - also if it is not part of the model. */
function exampleType(identifier: string | undefined, types: ModelType[]) {
  const type = identifier ? types.find((t) => t.identifier === identifier) : undefined;
  return {
    label: type ? typeName(type) : identifier ? shortName(identifier) : "Instance",
    color: type?.color || FALLBACK_COLOR,
  };
}

/** Example values of a list - shown as tags, as the editor does for linked instances. */
function Tags({ values, more }: { values: { label: string; color?: string }[]; more?: string }) {
  return (
    <div className="tag-container linked-instances-field">
      {values.map(({ label, color }) => (
        <Badge key={label} bg="light" text="dark" className="tag-badge me-2 mb-2 linked-instance-badge">
          {color && <FontAwesomeIcon icon={faCircle} className="linked-instance-badge-icon" style={{ color }} />}
          <span className="linked-instance-badge-name">{label}</span>
        </Badge>
      ))}
      {more && (
        <Button variant="link" size="sm" className="linked-instances-see-all-btn p-0 mb-2" tabIndex={-1}>
          {more}
        </Button>
      )}
    </div>
  );
}

/** An embedded instance with two example fields - as the editor shows the instances of nested fields. */
function NestedExample({ type, index }: { type: { label: string; color: string }; index?: number }) {
  return (
    <section className="nested-instance" style={{ borderLeftColor: type.color }}>
      <div className="nested-instance-header">
        <span className="nested-instance-type">
          <FontAwesomeIcon icon={faCircle} className="nested-instance-type-dot" style={{ color: type.color }} />
          {type.label}
          {index !== undefined && <span className="nested-instance-index">#{index}</span>}
        </span>
      </div>
      <div className="nested-instance-field">
        <Form.Label>Name</Form.Label>
        <Form.Control readOnly value={`Example ${type.label.toLowerCase()}`} />
      </div>
    </section>
  );
}

/**
 * An example of how a property is shown in the edit form of the editor with the widget - with example values. The
 * example is not interactive.
 */
export default function WidgetPreview({
  widget,
  targetTypes = [],
  types,
}: {
  widget: string | undefined;
  /** The types the property links to or embeds */
  targetTypes?: string[];
  types: ModelType[];
}) {
  const first = exampleType(targetTypes[0], types);
  const second = exampleType(targetTypes[1] ?? targetTypes[0], types);
  const links = [
    { label: `${first.label} A`, color: first.color, type: first.label },
    { label: `${second.label} B`, color: second.color, type: second.label },
  ];

  let control: React.ReactNode;
  switch (widgetKind(widget) ? widget : undefined) {
    case "InputText":
    case "AnnotatedInputText":
      control = <Form.Control readOnly value="Example text" />;
      break;
    case "InputTextMultiple":
      control = <Tags values={[{ label: "First value" }, { label: "Second value" }]} />;
      break;
    case "TextArea":
      control = <Form.Control as="textarea" rows={3} readOnly value={"An example text\nspanning several lines."} />;
      break;
    case "InputNumber":
      control = <Form.Control type="number" readOnly value={42} />;
      break;
    case "InputNumberMultiple":
      control = <Tags values={[{ label: "42" }, { label: "7.5" }]} />;
      break;
    case "InputDate":
      control = <Form.Control type="date" readOnly value="2026-10-29" />;
      break;
    case "InputDateTime":
      control = <Form.Control type="datetime-local" readOnly value="2026-10-29T14:30" />;
      break;
    case "InputTime":
      control = <Form.Control type="time" readOnly value="14:30" />;
      break;
    case "InputColor":
      control = <Form.Control type="color" className="form-control-color" readOnly value="#5b5fc7" />;
      break;
    case "CheckBox":
      control = <Form.Check type="checkbox" checked readOnly aria-label="Example value" />;
      break;
    case "SimpleDropdown":
      control = <Tags values={links.slice(0, 1)} more="Manage (1)" />;
      break;
    case "DynamicDropdown":
      control = <Tags values={links} more="Manage (2)" />;
      break;
    case "DynamicTable":
      control = (
        <Table size="sm" bordered className="modeler-preview-table mb-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {links.map(({ label, color, type }) => (
              <tr key={label}>
                <td>{label}</td>
                <td>
                  <FontAwesomeIcon icon={faCircle} className="linked-instance-badge-icon" style={{ color }} />
                  {type}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      );
      break;
    case "SingleNested":
      control = (
        <div className="nested-instances-field nested-instances-field--edit">
          <NestedExample type={first} />
        </div>
      );
      break;
    case "Nested":
      control = (
        <div className="nested-instances-field nested-instances-field--edit">
          <NestedExample type={first} index={1} />
          <NestedExample type={first} index={2} />
          <div className="nested-instances-add">
            <Button variant="outline-secondary" size="sm" tabIndex={-1}>
              <FontAwesomeIcon icon={faPlus} className="me-2" />
              Add {first.label}
            </Button>
          </div>
        </div>
      );
      break;
    default:
      control = <pre className="form-control modeler-preview-json mb-0">{'"Example value"'}</pre>;
  }

  const unsupported = !widgetKind(widget) || UNSUPPORTED_WIDGETS.includes(widget!);
  return (
    <>
      {/* The example only gives an impression - it can't be focused or changed */}
      <div className="modeler-preview" inert>
        {control}
      </div>
      {unsupported && (
        <div className="modeler-preview-note">
          {widget
            ? "The editor doesn't support this widget yet - it shows the value as raw JSON."
            : "Without a widget, the editor shows the value as raw JSON."}
        </div>
      )}
    </>
  );
}
