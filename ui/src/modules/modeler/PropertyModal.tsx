import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import { useAuth } from "../../contexts/AuthContext";
import {
  defineProperty,
  fetchPropertySpecification,
  LINK_WIDGETS,
  ModelProperty,
  ModelType,
  propertyName,
  PropertySpecification,
  suggestIdentifier,
  typeName,
  WIDGETS,
} from "../../services/modeler";

const IRI = /^[a-z][a-z0-9+.-]*:\S+$/i;

/**
 * Adds a property to a type or edits the specification of an existing one. A relation is a property with target
 * types - the instances of the type then link to instances of these types.
 */
export default function PropertyModal({
  type,
  types,
  property,
  relation,
  onHide,
  onSaved,
}: {
  type: ModelType;
  types: ModelType[];
  /** The property to edit - a new one is added if undefined */
  property?: ModelProperty;
  /** If the property is (initially) a relation */
  relation: boolean;
  onHide: () => void;
  onSaved: () => void;
}) {
  const { getAccessToken } = useAuth();
  const [specification, setSpecification] = useState<PropertySpecification | undefined>(
    property ? undefined : { widget: relation ? "DynamicDropdown" : "InputText", targetTypes: [] },
  );
  const [isRelation, setIsRelation] = useState(relation);
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
      .then((token) => fetchPropertySpecification(token, type.identifier, property.identifier))
      // The property can still be edited if its specification can't be loaded - it is shown as observed in the data
      .catch(() => undefined)
      .then((spec) => {
        if (!cancelled) {
          // The values not specified (neither for the type nor globally) are shown as observed in the data
          setSpecification({
            ...spec,
            name: spec?.name ?? property.name,
            nameForReverseLink: spec?.nameForReverseLink ?? property.nameForReverseLink,
            widget: spec?.widget ?? property.widget,
            required: spec?.required ?? property.required,
            orderNumber: spec?.orderNumber ?? property.orderNumber,
            targetTypes: spec?.targetTypes?.length ? spec.targetTypes : property.targetTypes,
          });
        }
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
  const targetTypes = specification?.targetTypes ?? [];
  const valid = IRI.test(effectiveIdentifier) && !duplicate && (!isRelation || targetTypes.length > 0);

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
        targetTypes: isRelation ? targetTypes : [],
        nameForReverseLink: isRelation ? specification.nameForReverseLink?.trim() || undefined : undefined,
      };
      await defineProperty(await getAccessToken(), type.identifier, effectiveIdentifier, body);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const title = property
    ? `Edit ${propertyName(property)}`
    : isRelation
      ? `Add relation to ${typeName(type)}`
      : `Add property to ${typeName(type)}`;

  return (
    <Modal show onHide={onHide} centered size="lg" className="modeler-modal">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
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
            {!property && (
              <Form.Group className="mb-3" controlId="modeler-property-new-name">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  size="sm"
                  value={specification.name ?? ""}
                  autoFocus
                  placeholder={isRelation ? "e.g. locatedIn" : "e.g. serialNumber"}
                  onChange={(e) => change({ name: e.target.value })}
                />
              </Form.Group>
            )}
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
            {property && (
              <Form.Group className="mb-3" controlId="modeler-property-name">
                <Form.Label>Name</Form.Label>
                <Form.Control size="sm" value={specification.name ?? ""} onChange={(e) => change({ name: e.target.value })} />
              </Form.Group>
            )}
            <Form.Check
              type="switch"
              id="modeler-property-relation"
              className="mb-3"
              label="Relation - the property links to instances of other types"
              checked={isRelation}
              onChange={(e) => {
                setIsRelation(e.target.checked);
                if (e.target.checked && !LINK_WIDGETS.includes(specification.widget ?? "")) {
                  change({ widget: "DynamicDropdown" });
                }
              }}
            />
            {isRelation && (
              <Row className="mb-3">
                <Col md={7} className="mb-3 mb-md-0">
                  <Form.Label>Target types</Form.Label>
                  <Form.Control
                    size="sm"
                    type="search"
                    className="mb-2"
                    placeholder="Filter types..."
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label="Filter target types"
                  />
                  <div className="modeler-checklist modeler-checklist-tall">
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
                </Col>
                <Col md={5}>
                  <Form.Group controlId="modeler-property-reverse">
                    <Form.Label>Name of the reverse link</Form.Label>
                    <Form.Control
                      size="sm"
                      value={specification.nameForReverseLink ?? ""}
                      placeholder="e.g. Contains"
                      onChange={(e) => change({ nameForReverseLink: e.target.value })}
                    />
                    <Form.Text muted>How the relation is labeled from the perspective of the linked instance.</Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            )}
            <Row>
              <Col sm={6}>
                <Form.Group className="mb-3" controlId="modeler-property-widget">
                  <Form.Label>Widget</Form.Label>
                  <Form.Select size="sm" value={specification.widget ?? ""} onChange={(e) => change({ widget: e.target.value || undefined })}>
                    <option value="">(default)</option>
                    {specification.widget && !WIDGETS.includes(specification.widget) && (
                      <option value={specification.widget}>{specification.widget}</option>
                    )}
                    {WIDGETS.map((widget) => (
                      <option key={widget} value={widget}>
                        {widget}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group className="mb-3" controlId="modeler-property-order">
                  <Form.Label>Order</Form.Label>
                  <Form.Control
                    size="sm"
                    type="number"
                    value={specification.orderNumber ?? ""}
                    onChange={(e) => change({ orderNumber: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </Form.Group>
              </Col>
            </Row>
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
