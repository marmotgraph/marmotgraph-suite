import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Spinner } from "react-bootstrap";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircle,
  faClone,
  faCode,
  faCopy,
  faPlay,
  faRotateLeft,
  faScrewdriverWrench,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../contexts/AuthContext";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import {
  deleteQuery,
  fetchQuery,
  QueryDocument,
  QueryProperty,
  QuerySpecification,
  saveQuery,
} from "../../services/queries";
import {
  addField,
  countProblems,
  fieldFor,
  fromSpecification,
  isLink,
  isQueryEmpty,
  moveField,
  newQuery,
  parameterNames,
  pathTo,
  propertyLabel,
  QueryField,
  QueryModel,
  removeField,
  setOption,
  specificationText,
  toSpecification,
  typeName,
  TypesById,
  updateField,
} from "./queryModel";
import { findSpace, spaceLabel, useQuerySpaces, useQueryTypes } from "./useQueryBuilderData";
import QueryStructure from "./QueryStructure";
import FieldOptions from "./FieldOptions";
import AddProperties from "./AddProperties";
import QueryJsonEditor from "./QueryJsonEditor";
import QueryExecution, { DEFAULT_RUN_SETTINGS, RunSettings, RunState } from "./QueryExecution";
import { DeleteQueryModal, SaveQueryModal } from "./QueryDialogs";
import "../editor/InstanceDetail.css";
import "./QueryBuilder.css";

type Mode = "build" | "json" | "run";

const MODES: { mode: Mode; icon: typeof faCode; title: string }[] = [
  { mode: "build", icon: faScrewdriverWrench, title: "Build query" },
  { mode: "json", icon: faCode, title: "Edit query as JSON" },
  { mode: "run", icon: faPlay, title: "Run query" },
];

type Dialog = "save" | "saveAs" | "delete";

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function withMeta(specification: QuerySpecification, label: string, description: string): QuerySpecification {
  return {
    ...specification,
    meta: { type: specification.meta.type, name: label, ...(description ? { description } : {}) },
  };
}

/** Builds, edits (as JSON), runs and manages a query - a new one (?new=1&type=...) or a stored one. */
export function QueryDetail() {
  const { queryId = "" } = useParams<{ queryId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { data: types, error: typesError } = useQueryTypes();
  const { data: spaces = [] } = useQuerySpaces();

  const isNewRoute = searchParams.get("new") === "1";
  const newType = searchParams.get("type") ?? "";

  const [stored, setStored] = useState<QueryDocument>();
  const [model, setModel] = useState<QueryModel>();
  /** The specification as loaded / stored - undefined for a query which isn't stored yet */
  const [baseline, setBaseline] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const [mode, setMode] = useState<Mode>("build");
  const [selectedKey, setSelectedKey] = useState("");
  const [dialog, setDialog] = useState<Dialog>();
  const [actionError, setActionError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [runSettings, setRunSettings] = useState<RunSettings>(DEFAULT_RUN_SETTINGS);
  const [run, setRun] = useState<RunState>({ page: 1, markers: [undefined] });
  /** A query just stored under this id doesn't need to be loaded again when the url changes to it */
  const justStored = useRef<string>(undefined);

  const apply = (next: QueryModel, nextStored: QueryDocument | undefined, nextBaseline: string | undefined) => {
    setModel(next);
    setStored(nextStored);
    setBaseline(nextBaseline);
    setSelectedKey(next.root.key);
  };

  useEffect(() => {
    if (!types) {
      return;
    }
    if (justStored.current === queryId) {
      justStored.current = undefined;
      return;
    }
    setLoadError(undefined);
    setRun({ page: 1, markers: [undefined] });
    if (isNewRoute) {
      if (!newType) {
        setLoadError("No type is given to create the query for.");
        return;
      }
      apply(newQuery(newType, types), undefined, undefined);
      return;
    }
    let cancelled = false;
    setModel(undefined);
    getAccessToken()
      .then((token) => fetchQuery(token, queryId))
      .then((document) => {
        if (!cancelled) {
          const loaded = fromSpecification(document.specification, types);
          apply(loaded, document, specificationText(loaded));
        }
      })
      .catch((e: unknown) => !cancelled && setLoadError(message(e)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryId, isNewRoute, newType, types, getAccessToken]);

  const specification = useMemo(() => (model ? toSpecification(model) : undefined), [model]);
  const currentText = useMemo(() => (specification ? JSON.stringify(specification, null, 2) : ""), [specification]);
  const hasChanges = !!model && (baseline === undefined ? !isQueryEmpty(model) : currentText !== baseline);

  useEffect(() => {
    if (!hasChanges) {
      return;
    }
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasChanges]);

  const space = findSpace(spaces, stored?.space);
  const isStored = !!stored;
  const canWrite = !isStored || !!space?.canWrite;
  const canDelete = isStored && !!space?.canDelete;
  const creatableSpaces = spaces.filter((s) => s.canCreate);

  if (typesError || loadError) {
    return (
      <div className="query-detail">
        <Alert variant="danger">{typesError ?? loadError}</Alert>
        <Button variant="outline-dark" size="sm" onClick={() => navigate("/queries")}>
          Back to the queries
        </Button>
      </div>
    );
  }

  if (!types || !model || !specification) {
    return (
      <div className="query-status-message" role="status">
        <Spinner animation="border" size="sm" className="me-2" />
        Loading query...
      </div>
    );
  }

  const typesById: TypesById = types;
  const path = pathTo(model.root, selectedKey);
  const selectedPath = path.length ? path : [model.root];
  const selected = selectedPath.at(-1) as QueryField;
  const rootColor = typesById.get(model.rootType)?.color || "#6c757d";
  const title = model.label.trim() || (isStored ? "Untitled query" : "New query");
  const problems = countProblems(model.root);

  const changeRoot = (update: (root: QueryField) => QueryField) =>
    setModel((current) => (current ? { ...current, root: update(current.root) } : current));

  const handleAdd = (property: QueryProperty, keepSelection: boolean) => {
    const field = fieldFor(property);
    changeRoot((root) => addField(root, selected.key, field));
    // A link needs child fields - it is selected right away to add them (unless the selection is to be kept)
    if (isLink(field) && !keepSelection) {
      setSelectedKey(field.key);
    }
  };

  const handleRemove = (key: string) => {
    if (pathTo(model.root, selectedKey).some((f) => f.key === key)) {
      setSelectedKey(pathTo(model.root, key).at(-2)?.key ?? model.root.key);
    }
    changeRoot((root) => removeField(root, key));
  };

  const handleApplyJson = (json: QuerySpecification) => {
    setModel(fromSpecification(json, typesById));
  };

  const storeNew = async (id: string, label: string, description: string, targetSpace: string) => {
    const token = await getAccessToken();
    const document = await saveQuery(token, id, withMeta(specification, label, description), targetSpace);
    const loaded = fromSpecification(document.specification, typesById);
    justStored.current = id;
    apply(loaded, document, specificationText(loaded));
    setDialog(undefined);
    navigate(`/queries/${id}`, { replace: !isStored });
  };

  const handleSave = () => {
    if (!isStored) {
      setDialog("save");
      return;
    }
    setSaving(true);
    setActionError(undefined);
    getAccessToken()
      .then((token) => saveQuery(token, queryId, specification))
      .then((document) => {
        const loaded = fromSpecification(document.specification, typesById);
        apply(loaded, document, specificationText(loaded));
      })
      .catch((e: unknown) => setActionError(message(e)))
      .finally(() => setSaving(false));
  };

  const handleUndo = () => {
    if (stored) {
      const loaded = fromSpecification(stored.specification, typesById);
      apply(loaded, stored, specificationText(loaded));
    } else {
      apply(newQuery(model.rootType, typesById), undefined, undefined);
    }
  };

  const handleDelete = async () => {
    const token = await getAccessToken();
    await deleteQuery(token, queryId);
    setBaseline(currentText);
    navigate("/queries");
  };

  const copyId = () => {
    navigator.clipboard
      .writeText(queryId)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };

  return (
    <div className="query-detail">
      <Breadcrumbs
        items={[
          { id: "queries", label: "Queries" },
          { id: queryId, label: title, color: rootColor },
        ]}
        onItemClick={(_, index) => index === 0 && navigate("/queries")}
      />
      <div className="instance-focus-panel" style={{ "--instance-type-color": rootColor } as React.CSSProperties}>
        <div className="instance-header">
          <div className="instance-header-layout">
            <div className="query-header-tools" role="toolbar" aria-label="Query tools">
              <div className="instance-header-modes" role="group" aria-label="Mode">
                {MODES.map(({ mode: target, icon, title: modeTitle }) => (
                  <Button
                    key={target}
                    variant="link"
                    className={`edit-icon-btn${mode === target ? " edit-icon-btn--active" : ""}`}
                    onClick={() => setMode(target)}
                    aria-label={modeTitle}
                    aria-pressed={mode === target}
                    title={modeTitle}
                  >
                    <FontAwesomeIcon icon={icon} />
                  </Button>
                ))}
              </div>
              <span className="query-header-tools-divider" aria-hidden="true" />
              {(hasChanges || (!isStored && !isQueryEmpty(model))) && (
                <Button variant="link" className="edit-icon-btn" onClick={handleUndo} aria-label="Undo changes" title="Undo changes">
                  <FontAwesomeIcon icon={faRotateLeft} />
                </Button>
              )}
              {isStored && (
                <Button
                  variant="link"
                  className="edit-icon-btn"
                  onClick={() => setDialog("saveAs")}
                  disabled={isQueryEmpty(model) || !creatableSpaces.length}
                  aria-label="Save as new query"
                  title="Save as new query"
                >
                  <FontAwesomeIcon icon={faClone} />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="link"
                  className="edit-icon-btn"
                  onClick={() => setDialog("delete")}
                  aria-label="Delete query"
                  title="Delete query"
                >
                  <FontAwesomeIcon icon={faTrashAlt} />
                </Button>
              )}
              {canWrite ? (
                <Button
                  variant="outline-dark"
                  size="sm"
                  className="ms-2"
                  onClick={handleSave}
                  disabled={!hasChanges || isQueryEmpty(model) || saving || (!isStored && !creatableSpaces.length)}
                >
                  {saving && <Spinner animation="border" size="sm" role="status" className="me-2" />}
                  Save query
                </Button>
              ) : (
                <Button
                  variant="outline-dark"
                  size="sm"
                  className="ms-2"
                  onClick={() => setDialog("saveAs")}
                  disabled={isQueryEmpty(model) || !creatableSpaces.length}
                >
                  Save as new query
                </Button>
              )}
            </div>
            <div className="instance-header-identity">
              <div className="instance-type-label">
                <FontAwesomeIcon icon={faCircle} className="instance-type-color-icon me-2" style={{ color: rootColor }} />
                <span title={model.rootType}>Query on {typeName(typesById, model.rootType)}</span>
              </div>
            </div>
            <h2 className="instance-name">{title}</h2>
            {model.description.trim() && <p className="query-description">{model.description}</p>}
            <div className="instance-header-main">
              {hasChanges && (
                <div className="instance-unsaved-summary" role="status">
                  {isStored ? "Unsaved changes" : "Not saved yet"}
                </div>
              )}
              <div className="instance-meta">
                <div className="mb-1 d-flex align-items-center">
                  <strong className="me-2">ID:</strong>
                  <span className="query-id">{queryId}</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 ms-2"
                    onClick={copyId}
                    aria-label="Copy query id"
                    title={copied ? "Copied" : "Copy id"}
                  >
                    <FontAwesomeIcon icon={faCopy} />
                  </Button>
                </div>
                <div>
                  <strong>Space:</strong>{" "}
                  {isStored ? spaceLabel(space, stored?.space) : "Chosen when the query is saved"}
                  {isStored && !canWrite && " (read only - save a copy to change it)"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {actionError && (
          <Alert variant="danger" dismissible onClose={() => setActionError(undefined)}>
            {actionError}
          </Alert>
        )}
        {model.root.isUnknown && (
          <Alert variant="warning">
            The type <code>{model.rootType}</code> is not known - fields can&apos;t be resolved. Edit the query as JSON
            to fix it.
          </Alert>
        )}

        {mode === "build" && (
          <div className="query-builder">
            <section className="query-panel" aria-labelledby="query-structure-title">
              <h3 className="query-kicker" id="query-structure-title">
                Fields{problems > 0 && <span className="query-add-group-count ms-2">{problems} to fix</span>}
              </h3>
              <QueryStructure
                root={model.root}
                types={typesById}
                selectedKey={selected.key}
                onSelect={setSelectedKey}
                onMove={(key, direction) => changeRoot((root) => moveField(root, key, direction))}
                onRemove={handleRemove}
              />
            </section>
            <div>
              <section className="query-panel" aria-labelledby="query-options-title">
                <h3 className="query-kicker" id="query-options-title">
                  {selected === model.root ? "Query settings" : `Options of ${propertyLabel(selected.schema)}`}
                </h3>
                <FieldOptions
                  model={model}
                  path={selectedPath}
                  types={typesById}
                  readOnly={!canWrite}
                  onChangeModel={(change) => setModel((current) => (current ? { ...current, ...change } : current))}
                  onChangeField={(update) => changeRoot((root) => updateField(root, selected.key, update))}
                  onSetOption={(name, value) => changeRoot((root) => setOption(root, selected.key, name, value))}
                />
              </section>
              <section className="query-panel" aria-labelledby="query-add-title">
                <h3 className="query-kicker" id="query-add-title">
                  Add to {selected === model.root ? "the query" : propertyLabel(selected.schema)}
                </h3>
                <AddProperties field={selected} types={typesById} onAdd={handleAdd} />
              </section>
            </div>
          </div>
        )}
        {mode === "json" && <QueryJsonEditor initialText={currentText} onApply={handleApplyJson} />}
        {mode === "run" && (
          <QueryExecution
            specification={specification}
            parameterNames={parameterNames(model.root)}
            spaces={spaces}
            isEmpty={isQueryEmpty(model)}
            settings={runSettings}
            onChangeSettings={setRunSettings}
            run={run}
            onChangeRun={setRun}
          />
        )}
      </div>

      <SaveQueryModal
        show={dialog === "save" || dialog === "saveAs"}
        title={dialog === "saveAs" ? "Save as new query" : "Save query"}
        initialLabel={dialog === "saveAs" && model.label ? `${model.label} (copy)` : model.label}
        initialDescription={model.description}
        spaces={creatableSpaces}
        onCancel={() => setDialog(undefined)}
        onSave={(label, description, target) =>
          storeNew(dialog === "saveAs" ? crypto.randomUUID() : queryId, label, description, target)
        }
      />
      <DeleteQueryModal
        show={dialog === "delete"}
        label={title}
        onCancel={() => setDialog(undefined)}
        onDelete={handleDelete}
      />
    </div>
  );
}
