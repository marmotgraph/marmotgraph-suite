import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Form, Tab, Tabs } from "react-bootstrap";
import { Link } from "react-router-dom";
import { CircleDashed, Globe, Network, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  definePropertyOrder,
  defineType,
  deleteTypeSpecification,
  fetchPropertySources,
  fetchTypeSpecification,
  incomingRelations,
  ModelProperty,
  orderChanges,
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
import PropertyFields from "./PropertyFields";
import ValidationSchemas from "./ValidationSchemas";
import TypeSpaces from "./TypeSpaces";
import TypeIdentifier from "./TypeIdentifier";
import InlineEdit from "./InlineEdit";

type Props = ModelerContext & { type: ModelType };

/** The specification of the type - shared by the header and the properties. */
interface SpecificationProps {
  /** Undefined while it is loaded - the type as observed in the data if it has no specification */
  specification?: TypeSpecification;
  /** Saves the specification (creating it if needed) - throws if it fails */
  define: (specification: TypeSpecification) => Promise<void>;
}

type TabProps = Props & SpecificationProps;

/** The definition of a type - its specification, properties (incl. relations), validation schemas and spaces. */
export default function TypeDetails(props: Props) {
  const { type, reload, canDefineTypes } = props;
  const { getAccessToken } = useAuth();
  const [tab, setTab] = useState("properties");
  const unspecified = props.specificationStatus?.[type.identifier]?.specified === false;
  const [specification, setSpecification] = useState<TypeSpecification>();
  const [exists, setExists] = useState(false);
  const [headerError, setHeaderError] = useState<string>();

  const loadSpecification = useCallback(() => {
    getAccessToken()
      .then((token) => fetchTypeSpecification(token, type.identifier))
      .then((spec) => {
        setExists(!!spec);
        // Without a specification, the type is shown as observed in the data
        setSpecification(spec ?? observedSpecification(type));
      })
      .catch((e: Error) => setHeaderError(e.message));
  }, [getAccessToken, type]);

  useEffect(loadSpecification, [loadSpecification]);

  const define = async (changed: TypeSpecification) => {
    const previous = specification;
    // The change is shown while it is saved
    setSpecification(changed);
    try {
      await defineType(await getAccessToken(), type.identifier, changed);
    } catch (e) {
      setSpecification(previous);
      throw e;
    }
    setExists(true);
    await reload();
  };

  /** Saves a change of the definition made in the header. */
  const defineInHeader = async (changes: Partial<TypeSpecification>) => {
    if (!specification) {
      return false;
    }
    setHeaderError(undefined);
    try {
      await define({ ...specification, ...changes });
      return true;
    } catch (e) {
      setHeaderError((e as Error).message);
      return false;
    }
  };

  const removeSpecification = async () => {
    if (!window.confirm(`Delete the definition of ${typeName(type)}? Instances of the type are not affected.`)) {
      return;
    }
    setHeaderError(undefined);
    try {
      await deleteTypeSpecification(await getAccessToken(), type.identifier);
      await reload();
      loadSpecification();
    } catch (e) {
      setHeaderError((e as Error).message);
    }
  };

  const editable = canDefineTypes && !!specification;
  const embeddedOnly = specification?.embeddedOnly ?? type.embeddedOnly;
  const tabProps: TabProps = { ...props, specification, define };
  return (
    <div
      className="instance-focus-panel modeler-type-details"
      style={{ "--instance-type-color": type.color || "#6c757d" } as React.CSSProperties}
    >
      <div className="instance-header">
        <div className="d-flex align-items-start gap-2">
          <div className="modeler-header-main">
            <div className="instance-type-label d-flex align-items-center">
              <TypeColor
                color={specification?.color ?? type.color}
                editable={editable}
                onSave={(color) => defineInHeader({ color })}
              />
              Type
            </div>
            <InlineEdit
              as="h2"
              className="instance-name"
              value={specification?.name ?? ""}
              display={typeName(type)}
              placeholder={shortName(type.identifier)}
              label="type name"
              editable={editable}
              onSave={(name) => defineInHeader({ name: name || undefined })}
            />
          </div>
          <Link
            to={`/modeler/graph?type=${encodeURIComponent(type.identifier)}`}
            className="btn btn-link edit-icon-btn flex-shrink-0"
            title="Show in graph"
            aria-label="Show in graph"
          >
            <Network size={16} />
          </Link>
          {canDefineTypes && exists && (
            <Button
              size="sm"
              variant="link"
              className="edit-icon-btn flex-shrink-0"
              title="Delete the definition (instances of the type are not affected)"
              aria-label="Delete definition"
              onClick={removeSpecification}
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
        <TypeIdentifier identifier={type.identifier} />
        <div className="instance-meta d-flex align-items-center flex-wrap gap-2 mt-2">
          {type.occurrences !== undefined && (
            <span>
              <strong>{type.occurrences}</strong> instances
            </span>
          )}
          {unspecified && <UnspecifiedBadge what="type" />}
          {editable ? (
            <Form.Check
              type="switch"
              id="modeler-type-embedded"
              className="modeler-header-switch"
              label="Embedded only"
              title="Instances of the type only exist embedded in other instances (they are not listed on their own)"
              checked={embeddedOnly}
              onChange={(e) => defineInHeader({ embeddedOnly: e.target.checked })}
            />
          ) : (
            embeddedOnly && (
              <span
                className="modeler-status"
                title="Instances of the type only exist embedded in other instances (they are not listed on their own)"
              >
                Embedded only
              </span>
            )
          )}
        </div>
        <InlineEdit
          as="p"
          className="instance-meta modeler-type-description"
          value={specification?.description ?? ""}
          display={type.description ?? ""}
          placeholder="Add a description"
          label="type description"
          multiline
          editable={editable}
          onSave={(description) => defineInHeader({ description: description || undefined })}
        />
        {headerError && (
          <Alert variant="danger" className="mt-2 mb-0 py-2" dismissible onClose={() => setHeaderError(undefined)}>
            {headerError}
          </Alert>
        )}
      </div>
      <Tabs activeKey={tab} onSelect={(key) => setTab(key ?? "properties")} className="mb-3" mountOnEnter>
        <Tab eventKey="properties" title={`Properties (${type.properties.length})`}>
          <PropertiesTab {...tabProps} />
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

/** The color of the type - a swatch which opens a color picker if it can be changed. */
function TypeColor({ color, editable, onSave }: { color?: string; editable: boolean; onSave: (color: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  // The color while it is picked - it's only saved when the picker is closed
  const [picking, setPicking] = useState<string>();

  useEffect(() => {
    const element = input.current;
    if (!element) {
      return;
    }
    // React's onChange fires on every move in the picker - the native change event only when a color was chosen
    const chosen = () => {
      setPicking(undefined);
      onSave(element.value);
    };
    element.addEventListener("change", chosen);
    return () => element.removeEventListener("change", chosen);
  }, [editable, onSave]);

  const shown = picking ?? color;
  const dot = <span className="modeler-color-dot" style={{ backgroundColor: shown || "#6c757d" }} />;
  if (!editable) {
    return <span className="me-2 d-inline-flex">{dot}</span>;
  }
  return (
    <label className="modeler-color-swatch me-1" title={`Change the color${color ? ` (${color})` : ""}`}>
      {dot}
      <input
        ref={input}
        type="color"
        className="visually-hidden"
        aria-label="Type color"
        value={/^#[0-9a-f]{6}$/i.test(shown ?? "") ? shown : "#adb5bd"}
        onChange={(e) => setPicking(e.target.value)}
      />
    </label>
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

/** The specification of a type without one - the type as observed in the data. */
function observedSpecification(type: ModelType): TypeSpecification {
  return {
    name: type.name,
    description: type.description,
    color: type.color,
    labelProperty: type.labelProperty,
    searchableProperties: [],
    embeddedOnly: type.embeddedOnly,
  };
}

function PropertiesTab({ type, types, reload, canDefineTypes, specification, define }: TabProps) {
  const { getAccessToken } = useAuth();
  const [editing, setEditing] = useState<{ property?: ModelProperty }>();
  const [error, setError] = useState<string>();
  const incoming = useMemo(() => incomingRelations(types, type.identifier), [types, type.identifier]);
  // Where the specifications of the properties come from - undefined while they are checked (or if they can't be)
  const [sources, setSources] = useState<Record<string, SpecificationSource>>();
  // The order of the properties while it is saved - shown before the model is reloaded
  const [ordered, setOrdered] = useState<ModelProperty[]>();
  const [flagging, setFlagging] = useState(false);

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

  /** Changes the label or the searchable properties of the type - saved right away (creating a definition if needed). */
  const flag = async (changes: Partial<TypeSpecification>) => {
    if (!specification) {
      return;
    }
    setFlagging(true);
    setError(undefined);
    try {
      await define({ ...specification, ...changes });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFlagging(false);
    }
  };

  const reorder = async (properties: ModelProperty[]) => {
    setOrdered(properties);
    setError(undefined);
    try {
      const token = await getAccessToken();
      // Only the properties whose position changed are updated
      await Promise.all(
        orderChanges(properties).map(({ property, orderNumber }) =>
          definePropertyOrder(token, type.identifier, property.identifier, orderNumber),
        ),
      );
    } catch (e) {
      setError(`The order could not be saved completely: ${(e as Error).message}`);
    }
    try {
      await reload();
    } finally {
      setOrdered(undefined);
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
        <div className="d-flex align-items-center gap-3 mb-3">
          <Button size="sm" variant="outline-secondary" className="d-flex align-items-center" onClick={() => setEditing({})}>
            <Plus size={16} className="me-1" />
            Add property
          </Button>
          {type.properties.length > 1 && (
            <span className="modeler-hint">Drag the properties to change the order they are shown in the editor.</span>
          )}
        </div>
      )}
      {type.properties.length === 0 ? (
        <p className="modeler-empty">The type has no properties yet.</p>
      ) : (
        <PropertyFields
          properties={ordered ?? type.properties}
          types={types}
          sources={sources}
          canDefine={canDefineTypes}
          saving={!!ordered}
          onReorder={reorder}
          onEdit={(property) => setEditing({ property })}
          onRemove={remove}
          renderBadges={(property) => (
            <>
              {sources?.[property.identifier] === "NONE" && <UnspecifiedBadge what="property" />}
              {sources?.[property.identifier] === "GLOBAL" && <GlobalBadge />}
            </>
          )}
          renderLinks={(property) =>
            property.targetTypes.map((target) => <TypeLink key={target} identifier={target} types={types} />)
          }
          renderFlags={(property) => {
            const name = propertyName(property);
            const searchable = specification?.searchableProperties ?? [];
            const disabled = !canDefineTypes || !specification || flagging;
            return (
              <span className="modeler-field-flags">
                <Form.Check
                  type="switch"
                  id={`modeler-label-${property.identifier}`}
                  label="Label"
                  aria-label={`Label instances with ${name}`}
                  title="The instances of the type are labeled with this property"
                  disabled={disabled}
                  checked={specification?.labelProperty === property.identifier}
                  onChange={(e) => flag({ labelProperty: e.target.checked ? property.identifier : undefined })}
                />
                <Form.Check
                  type="switch"
                  id={`modeler-searchable-${property.identifier}`}
                  label="Searchable"
                  aria-label={`Search instances by ${name}`}
                  title="The instances of the type can be found by this property"
                  disabled={disabled}
                  checked={searchable.includes(property.identifier)}
                  onChange={(e) =>
                    flag({
                      searchableProperties: e.target.checked
                        ? [...searchable, property.identifier]
                        : searchable.filter((p) => p !== property.identifier),
                    })
                  }
                />
              </span>
            );
          }}
        />
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
