import React, { useMemo, useState } from "react";
import { Alert, Button, Col, Form, Modal, Row } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CircleDashed, Plus } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSubNavActions } from "../../contexts/SubNavActionsContext";
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

  useSubNavActions(
    canDefineTypes ? [{ label: "Create new type", icon: <Plus size={16} />, onClick: () => setCreating(true) }] : [],
  );

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
          <Form.Control
            size="sm"
            type="search"
            className="mb-2"
            placeholder="Filter types..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter types"
          />
          <div className="modeler-result-count">
            {visible.length === types.length ? `${types.length} types` : `${visible.length} of ${types.length} types`}
          </div>
          <div className="modeler-type-list">
            {visible.map((type) => {
              const status = specificationStatus?.[type.identifier];
              const relationCount = relationCounts.get(type.identifier);
              return (
                <button
                  type="button"
                  key={type.identifier}
                  aria-current={type.identifier === selected ? "true" : undefined}
                  onClick={() => select(type.identifier)}
                  className={`modeler-type-item${type.identifier === selected ? " modeler-type-item--selected" : ""}`}
                >
                  <span className="modeler-color-dot" style={{ backgroundColor: type.color || "#6c757d" }} />
                  <span className="modeler-type-item-name" title={type.identifier}>
                    {typeName(type)}
                  </span>
                  {status?.specified === false && (
                    <CircleDashed size={14} className="flex-shrink-0 modeler-unspecified" aria-label="Not specified">
                      <title>Not specified - the type is only known from the data</title>
                    </CircleDashed>
                  )}
                  <span className="ms-auto d-flex gap-1 ps-2">
                    <span className="modeler-count" title="Properties">
                      {type.properties.length}
                    </span>
                    {!!relationCount && (
                      <span className="modeler-count" title="Relations to other types">
                        {relationCount}
                        <ArrowRight size={10} className="ms-1" aria-hidden />
                      </span>
                    )}
                    {!!status?.unspecifiedProperties && (
                      <span
                        className="modeler-status modeler-status--unspecified"
                        title="Properties without a specification - they are only known from the data"
                      >
                        <CircleDashed size={10} aria-hidden />
                        {status.unspecifiedProperties}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {visible.length === 0 && <p className="modeler-empty mb-0">No types match the filter.</p>}
          </div>
        </Col>
      )}
      {showDetails && (
        <Col md={8} lg={9}>
          {isMobile && (
            <Button variant="link" className="modeler-type-link px-0 mb-2 d-flex align-items-center" onClick={() => select(undefined)}>
              <ArrowLeft size={16} className="me-1" />
              All types
            </Button>
          )}
          {selectedType ? (
            <TypeDetails key={selectedType.identifier} type={selectedType} {...context} />
          ) : selected ? (
            <Alert variant="warning">The type {selected} is unknown (or not visible to you).</Alert>
          ) : (
            <p className="modeler-empty">Select a type to see and edit its definition, properties, validation schemas and spaces.</p>
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
    <Modal show={show} onHide={close} centered className="modeler-modal">
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
