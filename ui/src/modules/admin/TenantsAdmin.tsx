import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Col, Form, Modal, Row, Spinner, Tab, Tabs } from "react-bootstrap";
import { Plus, Upload } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSubNavActions } from "../../contexts/SubNavActionsContext";
import { useConfig } from "../../contexts/ConfigContext";
import SaveButton from "../../components/SaveButton";
import {
  Colors,
  defineTenant,
  fetchTenant,
  fetchTenantNames,
  Font,
  imageUrl,
  MODE_SPECIFIC_IMAGES,
  setColors,
  setCustomCss,
  setFont,
  Tenant,
  TENANT_NAME_PATTERN,
  TenantDefinition,
  TenantImage,
  uploadImage,
} from "../../services/tenants";

const COLOR_GROUP_LABELS: Record<string, string> = {
  brandColors: "Brand colors",
  greys: "Greys",
  blacks: "Blacks",
  stateColors: "State colors",
  linkColors: "Link colors",
};

const IMAGE_LABELS: Record<TenantImage, string> = {
  logo: "Logo",
  background: "Background image",
  favicon: "Favicon",
};

/** Lists the tenants of the core and allows to create new ones and to customize their definition and theme. */
export default function TenantsAdmin() {
  const { getAccessToken } = useAuth();
  const [names, setNames] = useState<string[]>();
  const [selected, setSelected] = useState<string>();
  const [tenant, setTenant] = useState<Tenant>();
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);

  const loadNames = useCallback(() => {
    getAccessToken()
      .then(fetchTenantNames)
      .then((n) => {
        setNames(n);
        setSelected((current) => current ?? n[0]);
      })
      .catch((e: Error) => setError(e.message));
  }, [getAccessToken]);

  useEffect(loadNames, [loadNames]);

  const loadTenant = useCallback(
    (name: string) => {
      setTenant(undefined);
      getAccessToken()
        .then((token) => fetchTenant(token, name))
        .then(setTenant)
        .catch((e: Error) => setError(e.message));
    },
    [getAccessToken],
  );

  useEffect(() => {
    if (selected) {
      loadTenant(selected);
    }
  }, [selected, loadTenant]);

  /** Runs a modification of the selected tenant and reloads it afterwards (to show what the core actually stored). */
  const modify = async (action: (token: string, name: string) => Promise<void>) => {
    if (!tenant) {
      return false;
    }
    setError(undefined);
    try {
      await action(await getAccessToken(), tenant.name);
      loadTenant(tenant.name);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const created = (name: string) => {
    setCreating(false);
    setNames((current) => (current?.includes(name) ? current : [...(current ?? []), name].sort()));
    setSelected(name);
    if (selected === name) {
      loadTenant(name);
    }
  };

  useSubNavActions([{ label: "Create new tenant", icon: <Plus size={16} />, onClick: () => setCreating(true) }]);

  return (
    <div>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      <Row>
        <Col md={3} className="mb-3">
          <div className="d-flex align-items-center mb-2">
            <span className="admin-kicker">Tenants</span>
            {names && <span className="admin-result-count ms-auto">{names.length}</span>}
          </div>
          {!names && !error && (
            <div className="admin-loading">
              <Spinner animation="border" size="sm" /> Loading tenants...
            </div>
          )}
          {names && names.length === 0 && <p className="admin-empty">No tenants are defined yet.</p>}
          {!!names?.length && (
            <div className="admin-tenant-list">
              {names.map((name) => (
                <button
                  type="button"
                  key={name}
                  aria-current={name === selected ? "true" : undefined}
                  className={`admin-tenant-item${name === selected ? " admin-tenant-item--selected" : ""}`}
                  onClick={() => setSelected(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </Col>
        <Col md={9}>
          {selected && !tenant && !error && (
            <div className="admin-loading">
              <Spinner animation="border" size="sm" /> Loading tenant...
            </div>
          )}
          {tenant && <TenantDetails key={tenant.name} tenant={tenant} modify={modify} />}
        </Col>
      </Row>
      <CreateTenantModal show={creating} existing={names ?? []} onHide={() => setCreating(false)} onCreated={created} />
    </div>
  );
}

type Modify = (action: (token: string, name: string) => Promise<void>) => Promise<boolean>;

function TenantDetails({ tenant, modify }: { tenant: Tenant; modify: Modify }) {
  const disabled = !tenant.editable;
  return (
    <div className="instance-focus-panel admin-tenant-details">
      <div className="instance-header">
        <div className="instance-type-label">Tenant</div>
        <h2 className="instance-name">{tenant.title || tenant.name}</h2>
        <div className="admin-tenant-name">{tenant.name}</div>
      </div>
      {disabled && (
        <Alert variant="info" className="py-2">
          The "{tenant.name}" tenant is provided by the core and can not be modified.
        </Alert>
      )}
      <Tabs defaultActiveKey="general" className="mb-3">
        <Tab eventKey="general" title="General">
          <GeneralForm tenant={tenant} disabled={disabled} modify={modify} />
        </Tab>
        <Tab eventKey="font" title="Font">
          <FontForm font={tenant.theme.font} disabled={disabled} modify={modify} />
        </Tab>
        <Tab eventKey="colors" title="Colors">
          <ColorsForm colors={tenant.theme.colors} disabled={disabled} modify={modify} />
        </Tab>
        <Tab eventKey="images" title="Images">
          <ImagesForm name={tenant.name} disabled={disabled} modify={modify} />
        </Tab>
        <Tab eventKey="css" title="Custom CSS">
          <CustomCssForm css={tenant.theme.customCss} disabled={disabled} modify={modify} />
        </Tab>
        <Tab eventKey="resultingCss" title="Resulting CSS">
          <pre className="admin-code admin-resulting-css">{tenant.css}</pre>
          <Form.Text muted>The stylesheet the core provides for the tenant - generated from its font, colors and custom CSS.</Form.Text>
        </Tab>
      </Tabs>
    </div>
  );
}

function DefinitionFields({
  definition,
  disabled,
  onChange,
}: {
  definition: TenantDefinition;
  disabled: boolean;
  onChange: (definition: TenantDefinition) => void;
}) {
  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>Title</Form.Label>
        <Form.Control
          size="sm"
          disabled={disabled}
          value={definition.title ?? ""}
          onChange={(e) => onChange({ ...definition, title: e.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Contact email</Form.Label>
        <Form.Control
          size="sm"
          type="email"
          disabled={disabled}
          value={definition.contactEmail ?? ""}
          onChange={(e) => onChange({ ...definition, contactEmail: e.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Copyright</Form.Label>
        <Form.Control
          size="sm"
          disabled={disabled}
          value={definition.copyright ?? ""}
          onChange={(e) => onChange({ ...definition, copyright: e.target.value })}
        />
      </Form.Group>
    </>
  );
}

function GeneralForm({ tenant, disabled, modify }: { tenant: Tenant; disabled: boolean; modify: Modify }) {
  const [definition, setDefinition] = useState<TenantDefinition>({
    title: tenant.title,
    contactEmail: tenant.contactEmail,
    copyright: tenant.copyright,
  });
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <DefinitionFields definition={definition} disabled={disabled} onChange={setDefinition} />
      {tenant.idNamespace && (
        <Form.Group className="mb-3">
          <Form.Label>Id namespace</Form.Label>
          <Form.Control size="sm" readOnly plaintext value={tenant.idNamespace} />
        </Form.Group>
      )}
      <SaveButton disabled={disabled} onSave={() => modify((token, name) => defineTenant(token, name, definition))} />
    </Form>
  );
}

function FontForm({ font: initial, disabled, modify }: { font: Font; disabled: boolean; modify: Modify }) {
  const [font, setFontState] = useState<Font>(initial ?? {});
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <Form.Group className="mb-3">
        <Form.Label>Font URL</Form.Label>
        <Form.Control
          size="sm"
          disabled={disabled}
          placeholder="https://fonts.googleapis.com/css?family=..."
          value={font.url ?? ""}
          onChange={(e) => setFontState({ ...font, url: e.target.value })}
        />
        <Form.Text muted>The stylesheet the font is imported from (optional).</Form.Text>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Font family</Form.Label>
        <Form.Control
          size="sm"
          disabled={disabled}
          placeholder="'Roboto', sans-serif"
          value={font.fontFamily ?? ""}
          onChange={(e) => setFontState({ ...font, fontFamily: e.target.value })}
        />
      </Form.Group>
      <SaveButton disabled={disabled} onSave={() => modify((token, name) => setFont(token, name, font))} />
    </Form>
  );
}

/** The value for the native color picker (which only supports #rrggbb) - undefined if the color has another format. */
function pickerValue(color: string | null | undefined): string | undefined {
  const match = color?.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  return match ? `#${match[1]}` : undefined;
}

function ColorsForm({ colors: initial, disabled, modify }: { colors: Colors; disabled: boolean; modify: Modify }) {
  const [colors, setColorsState] = useState<Colors>(initial);
  const change = (group: string, color: string, value: string) =>
    setColorsState({ ...colors, [group]: { ...colors[group], [color]: value } });
  const missing = Object.values(colors).some((group) => Object.values(group).some((v) => !v?.trim()));

  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      {Object.entries(colors).map(([group, values]) => (
        <fieldset key={group} className="mb-3">
          <legend className="admin-kicker">{COLOR_GROUP_LABELS[group] ?? group}</legend>
          <Row>
            {Object.entries(values).map(([color, value]) => {
              const picker = pickerValue(value);
              return (
                <Col key={color} xs={12} sm={6} lg={4} className="mb-2">
                  <Form.Label className="small mb-1">{color}</Form.Label>
                  <div className="d-flex align-items-center gap-2">
                    <Form.Control
                      type="color"
                      size="sm"
                      className="admin-color-picker"
                      disabled={disabled || !picker}
                      title={picker ? "Pick a color" : "Only available for colors in the format #rrggbb(aa)"}
                      value={picker ?? "#000000"}
                      // Keeps the alpha channel of the previous value (the picker doesn't support it)
                      onChange={(e) => change(group, color, e.target.value + (value?.trim().slice(7) ?? ""))}
                    />
                    <Form.Control
                      size="sm"
                      className="admin-code"
                      disabled={disabled}
                      isInvalid={!value?.trim()}
                      value={value ?? ""}
                      onChange={(e) => change(group, color, e.target.value)}
                    />
                    {/* An inset shadow instead of the background to keep the checkerboard visible behind transparent colors */}
                    <span className="admin-color-swatch" style={{ boxShadow: value ? `inset 0 0 0 1rem ${value}` : undefined }} />
                  </div>
                </Col>
              );
            })}
          </Row>
        </fieldset>
      ))}
      {missing && <p className="text-danger small">All colors are required.</p>}
      <SaveButton disabled={disabled || missing} onSave={() => modify((token, name) => setColors(token, name, colors))} />
    </Form>
  );
}

function ImagesForm({ name, disabled, modify }: { name: string; disabled: boolean; modify: Modify }) {
  const { coreUrl } = useConfig();
  const [version, setVersion] = useState(() => Date.now());
  const variants: { image: TenantImage; darkMode: boolean; label: string }[] = (
    ["logo", "background", "favicon"] as TenantImage[]
  ).flatMap((image) =>
    MODE_SPECIFIC_IMAGES.includes(image)
      ? [
          { image, darkMode: true, label: `${IMAGE_LABELS[image]} (dark mode)` },
          { image, darkMode: false, label: `${IMAGE_LABELS[image]} (bright mode)` },
        ]
      : [{ image, darkMode: true, label: IMAGE_LABELS[image] }],
  );

  const upload = async (image: TenantImage, darkMode: boolean, file: File | undefined) => {
    if (file && (await modify((token, tenant) => uploadImage(token, tenant, image, file, darkMode)))) {
      setVersion(Date.now());
    }
  };

  return (
    <Row>
      {variants.map(({ image, darkMode, label }) => (
        <Col key={`${image}-${darkMode}`} xs={12} sm={6} lg={4} className="mb-3">
          <div className="admin-kicker mb-1">{label}</div>
          <div className={`admin-image-preview ${darkMode ? "admin-image-preview-dark" : ""}`}>
            <img
              src={imageUrl(coreUrl, name, image, darkMode, version)}
              alt={label}
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              onLoad={(e) => (e.currentTarget.style.visibility = "visible")}
            />
          </div>
          <Form.Label
            className={`btn btn-sm btn-outline-secondary mt-2 d-inline-flex align-items-center ${disabled ? "disabled" : ""}`}
          >
            <Upload size={14} className="me-1" />
            Upload
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={disabled}
              onChange={(e) => {
                void upload(image, darkMode, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </Form.Label>
        </Col>
      ))}
    </Row>
  );
}

function CustomCssForm({ css: initial, disabled, modify }: { css: string; disabled: boolean; modify: Modify }) {
  const [css, setCss] = useState(initial ?? "");
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <Form.Group className="mb-3">
        <Form.Control
          as="textarea"
          rows={12}
          className="admin-code"
          disabled={disabled}
          placeholder=".my-class { ... }"
          value={css}
          onChange={(e) => setCss(e.target.value)}
        />
        <Form.Text muted>Appended to the stylesheet generated from the font and colors of the tenant.</Form.Text>
      </Form.Group>
      <SaveButton disabled={disabled} onSave={() => modify((token, name) => setCustomCss(token, name, css))} />
    </Form>
  );
}

function CreateTenantModal({
  show,
  existing,
  onHide,
  onCreated,
}: {
  show: boolean;
  existing: string[];
  onHide: () => void;
  onCreated: (name: string) => void;
}) {
  const { getAccessToken } = useAuth();
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState<TenantDefinition>({});
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setName("");
      setDefinition({});
      setError(undefined);
    }
  }, [show]);

  const trimmed = name.trim();
  const nameError = !trimmed
    ? undefined
    : !TENANT_NAME_PATTERN.test(trimmed)
      ? 'Only letters, digits, "-" and "_" are allowed'
      : existing.includes(trimmed)
        ? "A tenant with this name already exists"
        : undefined;

  const create = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await defineTenant(await getAccessToken(), trimmed, definition);
      onCreated(trimmed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered className="admin-modal">
      <Modal.Header closeButton>
        <Modal.Title>New tenant</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form onSubmit={(e) => e.preventDefault()}>
          <Form.Group className="mb-3">
            <Form.Label>
              Name <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              size="sm"
              autoFocus
              value={name}
              isInvalid={!!nameError}
              onChange={(e) => setName(e.target.value)}
            />
            <Form.Control.Feedback type="invalid">{nameError}</Form.Control.Feedback>
          </Form.Group>
          <DefinitionFields definition={definition} disabled={false} onChange={setDefinition} />
          <Form.Text muted>The theme (font, colors, images) can be customized once the tenant is created.</Form.Text>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="dark" disabled={saving || !trimmed || !!nameError} onClick={create}>
          {saving ? <Spinner animation="border" size="sm" /> : "Create"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
