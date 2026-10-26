import React, { useMemo, useState } from "react";
import { Alert, Badge, Button, Col, Form, ListGroup, Modal, Row } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleDashed, Plus } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { MOBILE_VIEWPORT_QUERY, useMediaQuery } from "../../hooks/useMediaQuery";
import { defineType, relations, suggestIdentifier, typeName } from "../../services/modeler";
import type { ModelerContext } from "./ModelerHome";
import TypeDetails from "./TypeDetails";

/** Lists the types of the model - the selected one is shown with its details to be edited. */
export default function TypeList(context: ModelerContext) {
  const { types, specificationStatus, canDefineTypes } = context;
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery(MOBILE_VIEWPORT_QUERY);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const selected = searchParams.get("type") ?? undefined;
  const selectedType = types.find((type) => type.identifier === selected);

  const select = (identifier?: string) => setSearchParams(identifier ? { type: identifier } : {});

  const sorted = useMemo(
    () => [...types].sort((a, b) => typeName(a).localeCompare(typeName(b), undefined, { sensitivity: "base" })),
    [types],
  );
  const relationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    relations(types).forEach((relation) => counts.set(relation.source, (counts.get(relation.source) ?? 0) + 1));
    return counts;
  }, [types]);
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? sorted.filter((type) => typeName(type).toLowerCase().includes(needle) || type.identifier.toLowerCase().includes(needle))
    : sorted;

  // On a phone, either the list or the selected type is shown
  const showList = !isMobile || !selectedType;
  const showDetails = !isMobile || !!selectedType;

  return (
    <Row>
      {showList && (
        <Col md={4} lg={3} className="mb-3">
          <div className="d-flex align-items-center mb-2 gap-2">
            <Form.Control
              size="sm"
              type="search"
              placeholder="Filter types..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter types"
            />
            {canDefineTypes && (
              <Button size="sm" variant="dark" className="d-flex align-items-center text-nowrap" onClick={() => setCreating(true)}>
                <Plus size={16} className="me-1" />
                New type
              </Button>
            )}
          </div>
          <div className="text-muted small mb-2">
            {visible.length === types.length ? `${types.length} types` : `${visible.length} of ${types.length} types`}
          </div>
          <ListGroup className="modeler-type-list">
            {visible.map((type) => (
              <ListGroup.Item
                key={type.identifier}
                action
                active={type.identifier === selected}
                onClick={() => select(type.identifier)}
                className="d-flex align-items-center"
              >
                <span className="modeler-color-dot me-2" style={{ backgroundColor: type.color || "#adb5bd" }} />
                <span className="text-truncate" title={type.identifier}>
                  {typeName(type)}
                </span>
                {specificationStatus?.[type.identifier]?.specified === false && (
                  <CircleDashed
                    size={14}
                    className="ms-1 flex-shrink-0 modeler-unspecified"
                    aria-label="Not specified"
                  >
                    <title>Not specified - the type is only known from the data</title>
                  </CircleDashed>
                )}
                <span className="ms-auto d-flex gap-1 ps-2">
                  <Badge bg="light" text="dark" title="Properties">
                    {type.properties.length}
                  </Badge>
                  {!!relationCounts.get(type.identifier) && (
                    <Badge bg="secondary" title="Relations to other types">
                      {relationCounts.get(type.identifier)}
                    </Badge>
                  )}
                  {!!specificationStatus?.[type.identifier]?.unspecifiedProperties && (
                    <Badge
                      bg="warning"
                      text="dark"
                      className="d-inline-flex align-items-center"
                      title="Properties without a specification - they are only known from the data"
                    >
                      <CircleDashed size={10} className="me-1" />
                      {specificationStatus[type.identifier].unspecifiedProperties}
                    </Badge>
                  )}
                </span>
              </ListGroup.Item>
            ))}
          </ListGroup>
          {visible.length === 0 && <p className="text-muted small mt-2">No types match the filter.</p>}
        </Col>
      )}
      {showDetails && (
        <Col md={8} lg={9}>
          {isMobile && (
            <Button variant="link" className="px-0 mb-2 d-flex align-items-center" onClick={() => select(undefined)}>
              <ArrowLeft size={16} className="me-1" />
              All types
            </Button>
          )}
          {selectedType ? (
            <TypeDetails key={selectedType.identifier} type={selectedType} {...context} />
          ) : selected ? (
            <Alert variant="warning">The type {selected} is unknown (or not visible to you).</Alert>
          ) : (
            <p className="text-muted">Select a type to see and edit its definition, properties, validation schemas and spaces.</p>
          )}
        </Col>
      )}
      <NewTypeModal
        show={creating}
        example={types[0]?.identifier}
        existing={types.map((type) => type.identifier)}
        onHide={() => setCreating(false)}
        onCreated={async (identifier) => {
          setCreating(false);
          await context.reload();
          select(identifier);
        }}
      />
    </Row>
  );
}

function NewTypeModal({
  show,
  example,
  existing,
  onHide,
  onCreated,
}: {
  show: boolean;
  /** An existing type - its namespace is suggested for the new one */
  example?: string;
  existing: string[];
  onHide: () => void;
  onCreated: (identifier: string) => void;
}) {
  const { getAccessToken } = useAuth();
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState<string>();
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#4c8bf5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  // The identifier follows the name until it is edited explicitly
  const effectiveIdentifier = identifier ?? suggestIdentifier(name, example);
  const duplicate = existing.includes(effectiveIdentifier);
  const valid = name.trim() && /^[a-z][a-z0-9+.-]*:\S+$/i.test(effectiveIdentifier) && !duplicate;

  const reset = () => {
    setName("");
    setIdentifier(undefined);
    setDescription("");
    setError(undefined);
  };

  const close = () => {
    reset();
    onHide();
  };

  const create = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await defineType(await getAccessToken(), effectiveIdentifier, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        embeddedOnly: false,
      });
      reset();
      onCreated(effectiveIdentifier);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={close} centered>
      <Modal.Header closeButton>
        <Modal.Title>New type</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form.Group className="mb-3" controlId="modeler-new-type-name">
          <Form.Label>Name</Form.Label>
          <Form.Control value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Device" autoFocus />
        </Form.Group>
        <Form.Group className="mb-3" controlId="modeler-new-type-identifier">
          <Form.Label>Identifier</Form.Label>
          <Form.Control
            className="modeler-code"
            value={effectiveIdentifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="https://example.org/types/Device"
            isInvalid={duplicate}
          />
          <Form.Control.Feedback type="invalid">This type already exists.</Form.Control.Feedback>
          <Form.Text muted>The full name (IRI) the type is referenced with in the instances.</Form.Text>
        </Form.Group>
        <Form.Group className="mb-3" controlId="modeler-new-type-description">
          <Form.Label>Description</Form.Label>
          <Form.Control as="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Form.Group>
        <Form.Group controlId="modeler-new-type-color">
          <Form.Label>Color</Form.Label>
          <Form.Control type="color" value={color} onChange={(e) => setColor(e.target.value)} className="modeler-color-picker" />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={close}>
          Cancel
        </Button>
        <Button variant="dark" disabled={!valid || saving} onClick={create}>
          Create
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
