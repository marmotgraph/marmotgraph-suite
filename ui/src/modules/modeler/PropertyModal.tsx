import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Spinner, ToggleButton, ToggleButtonGroup } from "react-bootstrap";
import { Globe } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  Cardinality,
  DefinitionScope,
  effectiveSpecification,
  fetchPropertyDefinitions,
  hasTypeSpecificValues,
  ModelProperty,
  ModelType,
  propertyName,
  PropertyDefinitions,
  PropertySpecification,
  savePropertyDefinition,
  suggestIdentifier,
  typeName,
  WIDGET_KINDS,
  widgetKind,
  widgetOf,
} from "../../services/modeler";
import WidgetPreview from "./WidgetPreview";

const IRI = /^[a-z][a-z0-9+.-]*:\S+$/i;

const NO_DEFINITIONS: PropertyDefinitions = { type: null, global: null };

/** The widget kinds offered - grouped by what the property holds. */
const WIDGET_GROUPS = [
  { label: "Values", kinds: WIDGET_KINDS.filter((kind) => !kind.holds) },
  { label: "Relations - links to instances of other types", kinds: WIDGET_KINDS.filter((kind) => kind.holds === "links") },
  { label: "Embedded instances", kinds: WIDGET_KINDS.filter((kind) => kind.holds === "embedded") },
];

/**
 * Adds a property to a type or edits the specification of an existing one. The widget defines how the property is
 * shown in the editor - and if it is a relation (it links to instances of its target types) or embeds instances.
 */
export default function PropertyModal({
  type,
  types,
  property,
  onHide,
  onSaved,
}: {
  type: ModelType;
  types: ModelType[];
  /** The property to edit - a new one is added if undefined */
  property?: ModelProperty;
  onHide: () => void;
  onSaved: () => void;
}) {
  const { getAccessToken } = useAuth();
  const [specification, setSpecification] = useState<PropertySpecification | undefined>(
    property
      ? undefined
      : {
          widget: "InputText",
          targetTypes: [],
          // New properties are added at the end of the form
          orderNumber: Math.max(type.properties.length, ...type.properties.map((p) => p.orderNumber ?? 0)) + 1,
        },
  );
  // The current definitions of the property - none for a new one
  const [definitions, setDefinitions] = useState<PropertyDefinitions>(NO_DEFINITIONS);
  const [scope, setScope] = useState<DefinitionScope>("type");
  const [identifier, setIdentifier] = useState<string>();
  const [typeFilter, setTypeFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!property) {
      return;
    }
    let cancelled = false;
    getAccessToken()
      .then((token) => fetchPropertyDefinitions(token, type.identifier, property.identifier))
      // The property can still be edited if its definitions can't be loaded - it is shown as observed in the data
      .catch(() => NO_DEFINITIONS)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        const spec = effectiveSpecification(loaded);
        const targetTypes = spec.targetTypes?.length ? spec.targetTypes : property.targetTypes;
        setDefinitions(loaded);
        // A property only defined globally is edited globally - unless the type defines values of its own
        setScope(loaded.global && !hasTypeSpecificValues(loaded) ? "global" : "type");
        // The values not specified (neither for the type nor globally) are shown as observed in the data
        setSpecification({
          ...spec,
          name: spec.name ?? property.name,
          nameForReverseLink: spec.nameForReverseLink ?? property.nameForReverseLink,
          // A property linking to instances without a widget is suggested to be shown as a relation
          widget: spec.widget ?? property.widget ?? (targetTypes.length > 0 ? "DynamicDropdown" : undefined),
          required: spec.required ?? property.required,
          orderNumber: spec.orderNumber ?? property.orderNumber,
          targetTypes,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, type.identifier, property]);

  // New properties are suggested in the namespace of the existing ones (e.g. https://schema.org/)
  const example = useMemo(
    () => type.properties[0]?.identifier ?? types.flatMap((t) => t.properties)[0]?.identifier ?? type.identifier,
    [type, types],
  );
  const effectiveIdentifier = property?.identifier ?? identifier ?? suggestIdentifier(specification?.name ?? "", example);
  const duplicate = !property && type.properties.some((p) => p.identifier === effectiveIdentifier);
  const known = widgetKind(specification?.widget);
  const holds = known?.kind.holds;
  const targetTypes = specification?.targetTypes ?? [];
  const valid = IRI.test(effectiveIdentifier) && !duplicate && (!holds || targetTypes.length > 0);

  const sortedTypes = useMemo(
    () => [...types].sort((a, b) => typeName(a).localeCompare(typeName(b), undefined, { sensitivity: "base" })),
    [types],
  );
  const needle = typeFilter.trim().toLowerCase();
  // The selected target types stay visible while filtering
  const visibleTypes = sortedTypes.filter(
    (t) => !needle || targetTypes.includes(t.identifier) || typeName(t).toLowerCase().includes(needle),
  );

  const change = (changes: Partial<PropertySpecification>) => setSpecification((current) => ({ ...current, ...changes }));

  const changeKind = (key: string) => {
    const kind = WIDGET_KINDS.find((k) => k.key === key);
    if (!kind) {
      // The widget is not specified - or an unknown one is kept
      change({ widget: key === "" ? undefined : key });
      return;
    }
    change({ widget: widgetOf(kind, known?.cardinality ?? "single") });
  };

  const save = async () => {
    if (!specification) {
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const body: PropertySpecification = {
        ...specification,
        name: specification.name?.trim() || undefined,
        // Only relations and embedded instances have target types - the widget defines what the property is
        targetTypes: holds ? targetTypes : [],
        nameForReverseLink: holds === "links" ? specification.nameForReverseLink?.trim() || undefined : undefined,
      };
      await savePropertyDefinition(await getAccessToken(), type.identifier, effectiveIdentifier, body, scope, definitions);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const previewName = specification?.name?.trim() || (property ? propertyName(property) : "New property");

  return (
    <Modal show onHide={onHide} centered scrollable className="modeler-modal">
      <Modal.Header closeButton>
        <Modal.Title>{property ? `Edit ${propertyName(property)}` : `Add property to ${typeName(type)}`}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {!specification ? (
          !error && (
            <div className="modeler-loading">
              <Spinner animation="border" size="sm" /> Loading property...
            </div>
          )
        ) : (
          <Form onSubmit={(e) => e.preventDefault()}>
            <div className="mb-3">
              <div className="form-label" id="modeler-property-scope">
                Applies to
              </div>
              <ToggleButtonGroup
                type="radio"
                name="modeler-property-scope"
                size="sm"
                aria-labelledby="modeler-property-scope"
                value={scope}
                onChange={(value: DefinitionScope) => setScope(value)}
              >
                <ToggleButton id="modeler-scope-type" value="type" variant="outline-secondary">
                  <span className="modeler-color-dot me-1" style={{ backgroundColor: type.color || "#6c757d" }} />
                  {typeName(type)} only
                </ToggleButton>
                <ToggleButton id="modeler-scope-global" value="global" variant="outline-secondary">
                  <Globe size={14} className="me-1" aria-hidden />
                  All types
                </ToggleButton>
              </ToggleButtonGroup>
              <Form.Text muted className="d-block">
                {scope === "type"
                  ? definitions.global
                    ? `Only the values differing from the global definition are stored for ${typeName(type)} - the others keep following it.`
                    : `Other types using the property are not affected.`
                  : `The definition applies to every type using the property - types with values of their own keep them.${
                      hasTypeSpecificValues(definitions) ? ` The values specific to ${typeName(type)} are dropped.` : ""
                    }`}
              </Form.Text>
            </div>
            <Form.Group className="mb-3" controlId="modeler-property-name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                size="sm"
                value={specification.name ?? ""}
                autoFocus={!property}
                placeholder="e.g. serialNumber"
                onChange={(e) => change({ name: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="modeler-property-identifier">
              <Form.Label>Identifier</Form.Label>
              <Form.Control
                size="sm"
                className="modeler-code"
                value={effectiveIdentifier}
                readOnly={!!property}
                plaintext={!!property}
                isInvalid={duplicate}
                onChange={(e) => setIdentifier(e.target.value)}
              />
              <Form.Control.Feedback type="invalid">The type already has this property.</Form.Control.Feedback>
              {!property && <Form.Text muted>The full name (IRI) of the property - properties can be shared by several types.</Form.Text>}
            </Form.Group>
            <div className="modeler-widget-row mb-3">
              <Form.Group controlId="modeler-property-widget" className="flex-grow-1">
                <Form.Label>Widget</Form.Label>
                <Form.Select size="sm" value={known?.kind.key ?? specification.widget ?? ""} onChange={(e) => changeKind(e.target.value)}>
                  <option value="">(not specified)</option>
                  {specification.widget && !known && <option value={specification.widget}>{specification.widget}</option>}
                  {WIDGET_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.kinds.map((kind) => (
                        <option key={kind.key} value={kind.key}>
                          {kind.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Form.Select>
              </Form.Group>
              {known && (
                <div>
                  <div className="form-label" id="modeler-property-cardinality">
                    Values
                  </div>
                  {known.kind.single && known.kind.multiple ? (
                    <ToggleButtonGroup
                      type="radio"
                      name="modeler-property-cardinality"
                      size="sm"
                      aria-labelledby="modeler-property-cardinality"
                      value={known.cardinality}
                      onChange={(cardinality: Cardinality) => change({ widget: widgetOf(known.kind, cardinality) })}
                    >
                      <ToggleButton id="modeler-cardinality-single" value="single" variant="outline-secondary">
                        Single
                      </ToggleButton>
                      <ToggleButton id="modeler-cardinality-multiple" value="multiple" variant="outline-secondary">
                        Multiple
                      </ToggleButton>
                    </ToggleButtonGroup>
                  ) : (
                    <div className="modeler-cardinality-fixed">{known.kind.single ? "Single only" : "Multiple only"}</div>
                  )}
                </div>
              )}
            </div>
            <div className="modeler-kicker">Preview</div>
            <div className="modeler-preview-box mb-3">
              <Form.Label className="modeler-preview-label">
                {previewName}
                {specification.required && " *"}
              </Form.Label>
              <WidgetPreview widget={specification.widget} targetTypes={targetTypes} types={types} />
            </div>
            {holds && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>{holds === "links" ? "Links to" : "Embedded types"}</Form.Label>
                  <Form.Control
                    size="sm"
                    type="search"
                    className="mb-2"
                    placeholder="Filter types..."
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label="Filter target types"
                  />
                  <div className="modeler-checklist">
                    {visibleTypes.map((t) => (
                      <Form.Check
                        key={t.identifier}
                        id={`modeler-target-${t.identifier}`}
                        label={
                          <span title={t.identifier}>
                            <span className="modeler-color-dot me-1" style={{ backgroundColor: t.color || "#6c757d" }} />
                            {typeName(t)}
                          </span>
                        }
                        checked={targetTypes.includes(t.identifier)}
                        onChange={(e) =>
                          change({
                            targetTypes: e.target.checked
                              ? [...targetTypes, t.identifier]
                              : targetTypes.filter((target) => target !== t.identifier),
                          })
                        }
                      />
                    ))}
                  </div>
                  {targetTypes.length === 0 && <Form.Text className="text-danger">Select at least one type.</Form.Text>}
                </Form.Group>
                {holds === "links" && (
                  <Form.Group className="mb-3" controlId="modeler-property-reverse">
                    <Form.Label>Name of the reverse link</Form.Label>
                    <Form.Control
                      size="sm"
                      value={specification.nameForReverseLink ?? ""}
                      placeholder="e.g. Contains"
                      onChange={(e) => change({ nameForReverseLink: e.target.value })}
                    />
                    <Form.Text muted>How the relation is labeled from the perspective of the linked instance.</Form.Text>
                  </Form.Group>
                )}
              </>
            )}
            <Form.Group className="mb-3" controlId="modeler-property-tooltip">
              <Form.Label>Tooltip</Form.Label>
              <Form.Control size="sm" value={specification.labelTooltip ?? ""} onChange={(e) => change({ labelTooltip: e.target.value || undefined })} />
            </Form.Group>
            <div className="d-flex gap-4">
              <Form.Check
                id="modeler-property-required"
                label="Required"
                checked={!!specification.required}
                onChange={(e) => change({ required: e.target.checked })}
              />
              <Form.Check
                id="modeler-property-readonly"
                label="Read only"
                checked={!!specification.readOnly}
                onChange={(e) => change({ readOnly: e.target.checked })}
              />
            </div>
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="dark" disabled={!specification || !valid || saving} onClick={save}>
          {saving ? <Spinner animation="border" size="sm" /> : "Save"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
