import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Spinner, Tab, Table, Tabs } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ArrowRight, CircleDashed, Globe, Network, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import SaveButton from "../../components/SaveButton";
import {
  defineType,
  deleteTypeSpecification,
  fetchPropertySources,
  fetchTypeSpecification,
  incomingRelations,
  ModelProperty,
  ModelType,
  propertyName,
  removeProperty,
  shortName,
  SpecificationSource,
  typeName,
  TypeSpecification,
} from "../../services/modeler";
import type { ModelerContext } from "./ModelerHome";
import PropertyModal from "./PropertyModal";
import ValidationSchemas from "./ValidationSchemas";
import TypeSpaces from "./TypeSpaces";
import TypeIdentifier from "./TypeIdentifier";

type Props = ModelerContext & { type: ModelType };

/** The definition of a type - its specification, properties (incl. relations), validation schemas and spaces. */
export default function TypeDetails(props: Props) {
  const { type } = props;
  const [tab, setTab] = useState("properties");
  const unspecified = props.specificationStatus?.[type.identifier]?.specified === false;
  return (
    <div
      className="instance-focus-panel modeler-type-details"
      style={{ "--instance-type-color": type.color || "#6c757d" } as React.CSSProperties}
    >
      <div className="instance-header">
        <div className="d-flex align-items-start gap-2">
          <div className="modeler-header-main">
            <div className="instance-type-label">
              <span className="modeler-color-dot me-2" style={{ backgroundColor: type.color || "#6c757d" }} />
              Type
            </div>
            <h2 className="instance-name">{typeName(type)}</h2>
          </div>
          <Link
            to={`/modeler/graph?type=${encodeURIComponent(type.identifier)}`}
            className="btn btn-link edit-icon-btn flex-shrink-0"
            title="Show in graph"
            aria-label="Show in graph"
          >
            <Network size={16} />
          </Link>
        </div>
        <TypeIdentifier identifier={type.identifier} />
        <div className="instance-meta d-flex align-items-center flex-wrap gap-2 mt-2">
          {type.occurrences !== undefined && (
            <span>
              <strong>{type.occurrences}</strong> instances
            </span>
          )}
          {unspecified && <UnspecifiedBadge what="type" />}
        </div>
        {type.description && <p className="instance-meta mt-2 mb-0">{type.description}</p>}
      </div>
      <Tabs activeKey={tab} onSelect={(key) => setTab(key ?? "properties")} className="mb-3" mountOnEnter>
        <Tab eventKey="properties" title={`Properties (${type.properties.length})`}>
          <PropertiesTab {...props} />
        </Tab>
        <Tab eventKey="general" title="Definition">
          <DefinitionTab {...props} />
        </Tab>
        <Tab eventKey="validation" title="Validation">
          <ValidationSchemas type={type.identifier} canDefine={props.canDefineSchemas} />
        </Tab>
        <Tab eventKey="spaces" title="Spaces">
          <TypeSpaces type={type} canDefine={props.canDefineTypes} />
        </Tab>
      </Tabs>
    </div>
  );
}

/** Marks a type or property without a specification - it is only known from the data. */
function UnspecifiedBadge({ what }: { what: "type" | "property" }) {
  return (
    <span
      className="modeler-status modeler-status--unspecified"
      title={`There is no specification for the ${what} - it is only known from the data`}
    >
      <CircleDashed size={12} aria-hidden />
      Not specified
    </span>
  );
}

/** Marks a property only specified globally (for all types) - not for this type. */
function GlobalBadge() {
  return (
    <span
      className="modeler-status"
      title="There is no specification of the property for this type - the global one (for all types) applies"
    >
      <Globe size={12} aria-hidden />
      Global
    </span>
  );
}

/** The link to a type of the model (keeping the current view). */
function TypeLink({ identifier, types }: { identifier: string; types: ModelType[] }) {
  const type = types.find((t) => t.identifier === identifier);
  return (
    <Link to={`?type=${encodeURIComponent(identifier)}`} className="modeler-type-link" title={identifier}>
      <span className="modeler-color-dot me-1" style={{ backgroundColor: type?.color || "#6c757d" }} />
      {type ? typeName(type) : shortName(identifier)}
    </Link>
  );
}

function PropertiesTab({ type, types, reload, canDefineTypes }: Props) {
  const { getAccessToken } = useAuth();
  const [editing, setEditing] = useState<{ property?: ModelProperty; relation: boolean }>();
  const [error, setError] = useState<string>();
  const incoming = useMemo(() => incomingRelations(types, type.identifier), [types, type.identifier]);
  // Where the specifications of the properties come from - undefined while they are checked (or if they can't be)
  const [sources, setSources] = useState<Record<string, SpecificationSource>>();

  useEffect(() => {
    let cancelled = false;
    setSources(undefined);
    getAccessToken()
      .then((token) => fetchPropertySources(token, type.identifier))
      .then((s) => !cancelled && setSources(s))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // The properties are checked again whenever the model is reloaded (e.g. after a property has been saved)
  }, [getAccessToken, type]);

  const remove = async (property: ModelProperty) => {
    if (!window.confirm(`Remove the definition of "${propertyName(property)}" from ${typeName(type)}?`)) {
      return;
    }
    setError(undefined);
    try {
      await removeProperty(await getAccessToken(), type.identifier, property.identifier);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      {canDefineTypes && (
        <div className="d-flex gap-2 mb-3">
          <Button size="sm" variant="outline-secondary" className="d-flex align-items-center" onClick={() => setEditing({ relation: false })}>
            <Plus size={16} className="me-1" />
            Add property
          </Button>
          <Button size="sm" variant="outline-secondary" className="d-flex align-items-center" onClick={() => setEditing({ relation: true })}>
            <ArrowRight size={16} className="me-1" />
            Add relation
          </Button>
        </div>
      )}
      {type.properties.length === 0 ? (
        <p className="modeler-empty">The type has no properties yet.</p>
      ) : (
        <div className="table-responsive">
          <Table size="sm" hover className="align-middle modeler-properties">
            <thead>
              <tr>
                <th>Property</th>
                <th>Widget</th>
                <th>Links to</th>
                <th className="text-end">Used</th>
                {canDefineTypes && <th />}
              </tr>
            </thead>
            <tbody>
              {type.properties.map((property) => (
                <tr key={property.identifier} className={sources?.[property.identifier] === "NONE" ? "modeler-unspecified-row" : undefined}>
                  <td>
                    <div className="fw-medium d-flex align-items-center flex-wrap gap-1">
                      <span>
                        {propertyName(property)}
                        {property.required && (
                          <span className="text-danger ms-1" title="Required">
                            *
                          </span>
                        )}
                      </span>
                      {sources?.[property.identifier] === "NONE" && <UnspecifiedBadge what="property" />}
                      {sources?.[property.identifier] === "GLOBAL" && <GlobalBadge />}
                    </div>
                    <TypeIdentifier identifier={property.identifier} />
                  </td>
                  <td>{property.widget ?? <span className="text-muted">-</span>}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      {property.targetTypes.map((target) => (
                        <TypeLink key={target} identifier={target} types={types} />
                      ))}
                    </div>
                  </td>
                  <td className="text-end text-muted modeler-num">{property.occurrences ?? 0}</td>
                  {canDefineTypes && (
                    <td className="text-end text-nowrap">
                      <Button
                        size="sm"
                        variant="link"
                        className="edit-icon-btn"
                        title="Edit"
                        aria-label={`Edit ${propertyName(property)}`}
                        onClick={() => setEditing({ property, relation: property.targetTypes.length > 0 })}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="link"
                        className="edit-icon-btn"
                        title="Remove the definition for this type (properties used by instances remain visible)"
                        aria-label={`Remove ${propertyName(property)}`}
                        onClick={() => remove(property)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <div className="modeler-kicker mt-4">Incoming relations ({incoming.length})</div>
      {incoming.length === 0 ? (
        <p className="modeler-empty">No type links to {typeName(type)}.</p>
      ) : (
        <ul className="list-unstyled small">
          {incoming.map((relation) => (
            <li key={`${relation.source} ${relation.property}`} className="mb-1">
              <TypeLink identifier={relation.source} types={types} />
              <span className="text-muted mx-1">via</span>
              <span className="fw-medium" title={relation.property}>
                {relation.label}
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <PropertyModal
          type={type}
          types={types}
          property={editing.property}
          relation={editing.relation}
          onHide={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await reload();
          }}
        />
      )}
    </>
  );
}

function DefinitionTab({ type, reload, canDefineTypes }: Props) {
  const { getAccessToken } = useAuth();
  const [specification, setSpecification] = useState<TypeSpecification>();
  const [exists, setExists] = useState(false);
  const [error, setError] = useState<string>();
  const disabled = !canDefineTypes;

  const load = useCallback(() => {
    getAccessToken()
      .then((token) => fetchTypeSpecification(token, type.identifier))
      .then((spec) => {
        setExists(!!spec);
        // Without a specification, the type is shown as observed in the data
        setSpecification(
          spec ?? {
            name: type.name,
            description: type.description,
            color: type.color,
            labelProperty: type.labelProperty,
            searchableProperties: [],
            embeddedOnly: type.embeddedOnly,
          },
        );
      })
      .catch((e: Error) => setError(e.message));
  }, [getAccessToken, type]);

  useEffect(load, [load]);

  if (!specification) {
    return error ? (
      <Alert variant="danger">{error}</Alert>
    ) : (
      <div className="modeler-loading">
        <Spinner animation="border" size="sm" /> Loading definition...
      </div>
    );
  }

  const change = (changes: Partial<TypeSpecification>) => setSpecification({ ...specification, ...changes });
  const searchable = specification.searchableProperties ?? [];

  const save = async () => {
    setError(undefined);
    try {
      await defineType(await getAccessToken(), type.identifier, specification);
      setExists(true);
      await reload();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete the definition of ${typeName(type)}? Instances of the type are not affected.`)) {
      return;
    }
    setError(undefined);
    try {
      await deleteTypeSpecification(await getAccessToken(), type.identifier);
      await reload();
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      {!exists && (
        <Alert variant="info" className="py-2">
          The type has no definition yet - it is shown as observed in the data. Saving creates a definition.
        </Alert>
      )}
      <Form.Group className="mb-3" controlId="modeler-type-name">
        <Form.Label>Name</Form.Label>
        <Form.Control size="sm" disabled={disabled} value={specification.name ?? ""} onChange={(e) => change({ name: e.target.value })} />
      </Form.Group>
      <Form.Group className="mb-3" controlId="modeler-type-description">
        <Form.Label>Description</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          size="sm"
          disabled={disabled}
          value={specification.description ?? ""}
          onChange={(e) => change({ description: e.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-3" controlId="modeler-type-color">
        <Form.Label>Color</Form.Label>
        <div className="d-flex align-items-center gap-2">
          <Form.Control
            type="color"
            disabled={disabled}
            className="modeler-color-picker"
            value={/^#[0-9a-f]{6}$/i.test(specification.color ?? "") ? specification.color : "#adb5bd"}
            onChange={(e) => change({ color: e.target.value })}
          />
          <Form.Control
            size="sm"
            disabled={disabled}
            className="modeler-code modeler-color-text"
            value={specification.color ?? ""}
            onChange={(e) => change({ color: e.target.value })}
            aria-label="Color value"
          />
        </div>
      </Form.Group>
      <Form.Group className="mb-3" controlId="modeler-type-label">
        <Form.Label>Label property</Form.Label>
        <Form.Select
          size="sm"
          disabled={disabled}
          value={specification.labelProperty ?? ""}
          onChange={(e) => change({ labelProperty: e.target.value || undefined })}
        >
          <option value="">(none)</option>
          {specification.labelProperty && !type.properties.some((p) => p.identifier === specification.labelProperty) && (
            <option value={specification.labelProperty}>{specification.labelProperty}</option>
          )}
          {type.properties.map((property) => (
            <option key={property.identifier} value={property.identifier}>
              {propertyName(property)} ({property.identifier})
            </option>
          ))}
        </Form.Select>
        <Form.Text muted>The property the instances of the type are labeled with.</Form.Text>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Searchable properties</Form.Label>
        {type.properties.length === 0 && <div className="text-muted small">The type has no properties yet.</div>}
        <div className="modeler-checklist">
          {type.properties.map((property) => (
            <Form.Check
              key={property.identifier}
              id={`modeler-searchable-${property.identifier}`}
              disabled={disabled}
              label={propertyName(property)}
              title={property.identifier}
              checked={searchable.includes(property.identifier)}
              onChange={(e) =>
                change({
                  searchableProperties: e.target.checked
                    ? [...searchable, property.identifier]
                    : searchable.filter((p) => p !== property.identifier),
                })
              }
            />
          ))}
        </div>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Check
          id="modeler-type-embedded"
          disabled={disabled}
          label="Embedded only"
          checked={specification.embeddedOnly}
          onChange={(e) => change({ embeddedOnly: e.target.checked })}
        />
        <Form.Text muted>Instances of the type only exist embedded in other instances (they are not listed on their own).</Form.Text>
      </Form.Group>
      <div className="d-flex gap-2">
        <SaveButton disabled={disabled} onSave={save} />
        {canDefineTypes && exists && (
          <Button size="sm" variant="outline-danger" className="d-flex align-items-center ms-auto" onClick={remove}>
            <Trash2 size={14} className="me-1" />
            Delete definition
          </Button>
        )}
      </div>
    </Form>
  );
}
