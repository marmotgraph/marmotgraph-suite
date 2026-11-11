import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { DisabledHint } from "../../components/DisabledHint";
import ToolCategoryIcon from "../../components/ToolCategoryIcon";
import { useAuth } from "../../contexts/AuthContext";
import { useTools } from "../../contexts/ToolsContext";
import { Claims } from "../../services/permissions";
import {
  deleteTool,
  deleteToolCategory,
  EVERY_AUTHENTICATED_USER,
  fetchToolCategories,
  fetchToolDefinitions,
  iconSource,
  saveTool,
  saveToolCategory,
  ToolCategory,
  ToolDefinition,
} from "../../services/tools";

interface CategoryDraft {
  id?: string;
  name: string;
  icon: string;
}

interface ToolDraft {
  id?: string;
  name: string;
  description: string;
  categoryId: string;
  endpoint: string;
  /** Listed to every authenticated user - otherwise to the users matching the claims */
  everyone: boolean;
  claims: string;
}

const CLAIMS_EXAMPLE = '{\n  "groups": ["^/dashboard-users$"]\n}';

/**
 * Manages the tools built on top of the graph - grouped by the category they are listed in. Categories carry the icon
 * shown in the navigation, tools the claims deciding who gets them listed.
 */
export default function ToolsAdmin() {
  const { getAccessToken } = useAuth();
  const { reload: reloadNavigation } = useTools();
  const [categories, setCategories] = useState<ToolCategory[]>();
  const [definitions, setDefinitions] = useState<ToolDefinition[]>([]);
  const [error, setError] = useState<string>();
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>();
  const [toolDraft, setToolDraft] = useState<ToolDraft>();

  const load = useCallback(() => {
    getAccessToken()
      .then((token) => Promise.all([fetchToolCategories(token), fetchToolDefinitions(token)]))
      .then(([c, d]) => {
        setCategories(c);
        setDefinitions(d);
      })
      .catch((e: Error) => setError(e.message));
  }, [getAccessToken]);

  useEffect(load, [load]);

  /** The categories with their tools - filtered by the names of either. */
  const sections = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return (categories ?? [])
      .map((category) => {
        const tools = definitions.filter((d) => d.category?.id === category.id);
        const categoryMatches = !term || category.name.toLowerCase().includes(term);
        return {
          category,
          count: tools.length,
          tools: categoryMatches ? tools : tools.filter((t) => t.name.toLowerCase().includes(term)),
          visible: categoryMatches || tools.some((t) => t.name.toLowerCase().includes(term)),
        };
      })
      .filter((section) => section.visible);
  }, [categories, definitions, filter]);

  /** Runs the modification and reloads everything (including the navigation) - true if it succeeded. */
  const modify = async (action: (token: string) => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action(await getAccessToken());
      load();
      reloadNavigation();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const removeCategory = (category: ToolCategory) => {
    if (window.confirm(`Delete the category "${category.name}"?`)) {
      void modify((token) => deleteToolCategory(token, category.id));
    }
  };

  const removeTool = (tool: ToolDefinition) => {
    if (window.confirm(`Delete the tool "${tool.name}"? It is no longer listed to anyone.`)) {
      void modify((token) => deleteTool(token, tool.id));
    }
  };

  const saveCategoryDraft = async () => {
    if (
      categoryDraft &&
      (await modify((token) =>
        saveToolCategory(token, { id: categoryDraft.id, name: categoryDraft.name.trim(), icon: categoryDraft.icon.trim() || undefined }),
      ))
    ) {
      setCategoryDraft(undefined);
    }
  };

  const draftClaims = useMemo(() => (toolDraft && !toolDraft.everyone ? parseClaims(toolDraft.claims) : {}), [toolDraft]);

  const saveToolDraft = async () => {
    if (!toolDraft) {
      return;
    }
    const claims = toolDraft.everyone ? EVERY_AUTHENTICATED_USER : draftClaims.claims;
    if (!claims) {
      return;
    }
    const specification = {
      name: toolDraft.name.trim(),
      description: toolDraft.description.trim() || undefined,
      categoryId: toolDraft.categoryId,
      endpoint: toolDraft.endpoint.trim(),
      claims,
    };
    if (await modify((token) => saveTool(token, specification, toolDraft.id))) {
      setToolDraft(undefined);
    }
  };

  const openTool = (categoryId: string, tool?: ToolDefinition) => {
    const everyone = !tool || isEveryone(tool.claims);
    setToolDraft({
      id: tool?.id,
      name: tool?.name ?? "",
      description: tool?.description ?? "",
      categoryId: tool?.category?.id ?? categoryId,
      endpoint: tool?.endpoint ?? "",
      everyone,
      claims: tool && !everyone ? JSON.stringify(tool.claims, null, 2) : CLAIMS_EXAMPLE,
    });
  };

  const iconPreview = iconSource(categoryDraft?.icon);
  const toolDraftValid =
    !!toolDraft?.name.trim() && !!toolDraft.categoryId && /^https?:\/\/\S+$/i.test(toolDraft.endpoint.trim()) && (toolDraft.everyone || !!draftClaims.claims);

  return (
    <div>
      <div className="d-flex align-items-center flex-wrap mb-3 gap-2">
        <Form.Control
          size="sm"
          type="search"
          className="admin-filter"
          placeholder="Filter by category or tool..."
          aria-label="Filter by category or tool"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button size="sm" variant="outline-secondary" onClick={() => setCategoryDraft({ name: "", icon: "" })}>
          <Plus size={14} aria-hidden /> Add category
        </Button>
        {categories && (
          <span className="admin-result-count ms-auto">
            {definitions.length} {definitions.length === 1 ? "tool" : "tools"} in {categories.length}{" "}
            {categories.length === 1 ? "category" : "categories"}
          </span>
        )}
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}

      {!categories && !error && (
        <div className="admin-loading">
          <Spinner animation="border" size="sm" /> Loading tools...
        </div>
      )}

      {categories?.length === 0 && <p className="admin-empty">No categories are defined yet. Add one to register tools in it.</p>}
      {!!categories?.length && sections.length === 0 && <p className="admin-empty">No tools match the filter.</p>}

      {sections.map(({ category, count, tools }) => (
        <section key={category.id} className="admin-space-card">
          <div className="admin-space-header">
            <span className="admin-tool-category-icon" aria-hidden="true">
              <ToolCategoryIcon icon={category.icon} size={16} />
            </span>
            <span>{category.name}</span>
            <span className="admin-space-unspecified">
              {count} {count === 1 ? "tool" : "tools"}
            </span>
            <Button
              size="sm"
              variant="link"
              className="ms-auto edit-icon-btn admin-icon-btn"
              title={`Add tool (${category.name})`}
              aria-label={`Add tool (${category.name})`}
              onClick={() => openTool(category.id)}
            >
              <Plus size={16} />
            </Button>
            <Button
              size="sm"
              variant="link"
              className="edit-icon-btn admin-icon-btn"
              title={`Edit category (${category.name})`}
              aria-label={`Edit category (${category.name})`}
              onClick={() => setCategoryDraft({ id: category.id, name: category.name, icon: category.icon ?? "" })}
            >
              <Pencil size={16} />
            </Button>
            <DisabledHint reason={count > 0 ? "Only a category without tools can be deleted" : undefined}>
              <Button
                size="sm"
                variant="link"
                className="edit-icon-btn admin-icon-btn"
                title={`Delete category (${category.name})`}
                aria-label={`Delete category (${category.name})`}
                disabled={busy || count > 0}
                onClick={() => removeCategory(category)}
              >
                <Trash2 size={16} />
              </Button>
            </DisabledHint>
          </div>
          <div className="admin-space-body">
            {tools.length === 0 && <p className="admin-space-empty">No tools are registered in this category.</p>}
            {tools.map((tool) => (
              <div key={tool.id} className="admin-role">
                <div className="d-flex align-items-start gap-2">
                  <div className="flex-grow-1 admin-tool-text">
                    <div className="admin-tool-name">{tool.name}</div>
                    {tool.description && <div className="admin-tool-description">{tool.description}</div>}
                    <a className="admin-tool-endpoint" href={tool.endpoint} target="_blank" rel="noopener noreferrer">
                      {tool.endpoint}
                      <ExternalLink size={12} className="ms-1" aria-hidden="true" />
                      <span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                    <div className="admin-tool-claims">
                      <span className="admin-kicker">Listed to</span>{" "}
                      {isEveryone(tool.claims) ? <span>every authenticated user</span> : <code>{JSON.stringify(tool.claims)}</code>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="link"
                    className="edit-icon-btn admin-icon-btn"
                    title={`Edit tool (${tool.name})`}
                    aria-label={`Edit tool (${tool.name})`}
                    onClick={() => openTool(category.id, tool)}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="link"
                    className="edit-icon-btn admin-icon-btn"
                    title={`Delete tool (${tool.name})`}
                    aria-label={`Delete tool (${tool.name})`}
                    disabled={busy}
                    onClick={() => removeTool(tool)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <Modal show={!!categoryDraft} onHide={() => setCategoryDraft(undefined)} centered className="admin-modal">
        <Modal.Header closeButton>
          <Modal.Title>{categoryDraft?.id ? "Edit category" : "Add category"}</Modal.Title>
        </Modal.Header>
        {categoryDraft && (
          <Modal.Body>
            <Form.Group className="mb-3" controlId="tool-category-name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                size="sm"
                placeholder="e.g. Search"
                value={categoryDraft.name}
                onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })}
              />
            </Form.Group>
            <Form.Group controlId="tool-category-icon">
              <Form.Label>Icon (SVG)</Form.Label>
              <div className="d-flex gap-3 align-items-start">
                <Form.Control
                  as="textarea"
                  rows={6}
                  className="admin-code"
                  placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>'
                  value={categoryDraft.icon}
                  onChange={(e) => setCategoryDraft({ ...categoryDraft, icon: e.target.value })}
                />
                <div className="admin-tool-icon-preview" aria-label="Icon preview" role="img">
                  {iconPreview ? <img src={iconPreview} alt="" /> : <span>None</span>}
                </div>
              </div>
              <Form.Text muted>
                Shown in the navigation. It has to be a self-contained SVG: no scripts, event handlers or links to anything outside
                the icon. Leave it empty for a generic icon.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
        )}
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setCategoryDraft(undefined)}>
            Cancel
          </Button>
          <Button variant="dark" disabled={busy || !categoryDraft?.name.trim()} onClick={saveCategoryDraft}>
            {busy ? <Spinner animation="border" size="sm" /> : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!toolDraft} onHide={() => setToolDraft(undefined)} centered className="admin-modal">
        <Modal.Header closeButton>
          <Modal.Title>{toolDraft?.id ? "Edit tool" : "Add tool"}</Modal.Title>
        </Modal.Header>
        {toolDraft && (
          <Modal.Body>
            <Form.Group className="mb-3" controlId="tool-name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                size="sm"
                placeholder="e.g. Dataset search"
                value={toolDraft.name}
                onChange={(e) => setToolDraft({ ...toolDraft, name: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="tool-description">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                size="sm"
                value={toolDraft.description}
                onChange={(e) => setToolDraft({ ...toolDraft, description: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="tool-category">
              <Form.Label>Category</Form.Label>
              <Form.Select size="sm" value={toolDraft.categoryId} onChange={(e) => setToolDraft({ ...toolDraft, categoryId: e.target.value })}>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="tool-endpoint">
              <Form.Label>URL</Form.Label>
              <Form.Control
                size="sm"
                type="url"
                placeholder="https://search.example.org"
                value={toolDraft.endpoint}
                isInvalid={!!toolDraft.endpoint.trim() && !/^https?:\/\/\S+$/i.test(toolDraft.endpoint.trim())}
                onChange={(e) => setToolDraft({ ...toolDraft, endpoint: e.target.value })}
              />
              <Form.Control.Feedback type="invalid">The URL has to start with http:// or https://</Form.Control.Feedback>
            </Form.Group>
            <fieldset>
              <legend className="form-label fs-6">Listed to</legend>
              <Form.Check
                type="radio"
                id="tool-everyone"
                name="tool-listed-to"
                label="Every authenticated user"
                checked={toolDraft.everyone}
                onChange={() => setToolDraft({ ...toolDraft, everyone: true })}
              />
              <Form.Check
                type="radio"
                id="tool-claims"
                name="tool-listed-to"
                label="Users matching the claims"
                checked={!toolDraft.everyone}
                onChange={() => setToolDraft({ ...toolDraft, everyone: false })}
              />
            </fieldset>
            {!toolDraft.everyone && (
              <Form.Group className="mt-2" controlId="tool-claims-json">
                <Form.Control
                  as="textarea"
                  rows={6}
                  className="admin-code"
                  aria-label="Claims (JSON)"
                  value={toolDraft.claims}
                  isInvalid={!!draftClaims.error}
                  onChange={(e) => setToolDraft({ ...toolDraft, claims: e.target.value })}
                />
                <Form.Control.Feedback type="invalid">{draftClaims.error}</Form.Control.Feedback>
                <Form.Text muted>
                  Matched against the user information of the identity provider - the leaves are regular expressions (or lists of
                  them), e.g. <code>{'{"groups": ["^/curators$"]}'}</code>. Administrators see all tools.
                </Form.Text>
              </Form.Group>
            )}
          </Modal.Body>
        )}
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setToolDraft(undefined)}>
            Cancel
          </Button>
          <Button variant="dark" disabled={busy || !toolDraftValid} onClick={saveToolDraft}>
            {busy ? <Spinner animation="border" size="sm" /> : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

/** Whether the claims list the tool to every authenticated user. */
function isEveryone(claims: Claims | undefined): boolean {
  return !!claims && Object.keys(claims).length === 1 && claims.authenticated === true;
}

/** Parses the JSON of the claims - it has to be a non-empty object. */
function parseClaims(json: string): { claims?: Claims; error?: string } {
  if (!json.trim()) {
    return { error: "The claims are required" };
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { error: "The claims have to be a JSON object" };
    }
    if (Object.keys(parsed).length === 0) {
      return { error: "The claims must not be empty" };
    }
    return { claims: parsed as Claims };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
