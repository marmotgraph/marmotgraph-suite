import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Spinner, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faGlasses, faPen } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../contexts/AuthContext";
import { SearchBar } from "../../components/SearchBar";
import { fetchQueries, QuerySummary } from "../../services/queries";
import { simpleName, typeName } from "./queryModel";
import { findSpace, spaceLabel, useQuerySpaces, useQueryTypes } from "./useQueryBuilderData";
import "../editor/EditorHome.css";
import "./SharedQueries.css";
import "./QueryBuilder.css";

type Scope = "all" | "private" | "shared";

function matches(query: QuerySummary, search: string): boolean {
  return [query.label, query.description, query.id].some((value) => value?.toLowerCase().includes(search));
}

/** Lists the stored queries the user can read - to open one, filtered by text, type and private / shared. */
export function QueryHome() {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { data: types } = useQueryTypes();
  const { data: spaces } = useQuerySpaces();
  const [queries, setQueries] = useState<QuerySummary[]>();
  const [error, setError] = useState<string>();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    getAccessToken()
      .then((token) => fetchQueries(token))
      .then((loaded) => !cancelled && setQueries(loaded))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, reload]);

  const label = (identifier: string) => (types ? typeName(types, identifier) : simpleName(identifier));

  const queryTypes = useMemo(
    () =>
      Array.from(new Set((queries ?? []).map((q) => q.type).filter((t): t is string => !!t))).sort((a, b) =>
        label(a).localeCompare(label(b)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queries, types],
  );

  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return (queries ?? [])
      .filter((q) => !text || matches(q, text))
      .filter((q) => !type || q.type === type)
      .filter((q) => {
        if (scope === "all") {
          return true;
        }
        const isPrivate = !!findSpace(spaces, q.space)?.isPrivate;
        return scope === "private" ? isPrivate : !isPrivate;
      })
      .sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id));
  }, [queries, search, type, scope, spaces]);

  const open = (query: QuerySummary) => navigate(`/queries/${query.id}`);

  return (
    <div className="editor-home query-home">
      <div className="mb-3">
        <h2>Queries</h2>
      </div>
      <div className="query-home-search mb-3">
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          onSearch={() => setSearch(searchInput)}
          placeholder="Search queries by title, description or id"
          ariaLabel="Search queries"
        />
      </div>
      <div className="query-home-filters mb-2">
        <Form.Select
          size="sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Filter by type"
          className="query-home-type-filter"
        >
          <option value="">All types</option>
          {queryTypes.map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </Form.Select>
        <div role="radiogroup" aria-label="Filter by space" className="query-home-scope">
          {(
            [
              ["all", "All queries"],
              ["private", "My private queries"],
              ["shared", "Shared queries"],
            ] as [Scope, string][]
          ).map(([value, text]) => (
            <Form.Check
              key={value}
              inline
              type="radio"
              id={`query-scope-${value}`}
              name="query-scope"
              label={text}
              checked={scope === value}
              onChange={() => setScope(value)}
            />
          ))}
        </div>
      </div>

      {error ? (
        <Alert variant="danger" className="d-flex align-items-center justify-content-between">
          <span>{error}</span>
          <Button variant="outline-dark" size="sm" onClick={() => setReload((r) => r + 1)}>
            Retry
          </Button>
        </Alert>
      ) : (
        <>
          <div className="instances-result-count text-muted small">
            {queries ? `${visible.length} of ${queries.length} queries` : " "}
          </div>
          <div className="editor-home-body">
          <div className="table-scroll-container">
            <Table className="shared-queries-table instances-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Saved in space</th>
                  <th>Permissions</th>
                </tr>
              </thead>
              <tbody>
                {!queries && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted">
                      <Spinner animation="border" size="sm" role="status" className="me-2" />
                      Loading queries...
                    </td>
                  </tr>
                )}
                {queries && visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="links-empty-state">
                      {queries.length === 0
                        ? "No saved queries yet. Create a new query to get started."
                        : "No queries match the filters."}
                    </td>
                  </tr>
                )}
                {visible.map((query) => {
                  const space = findSpace(spaces, query.space);
                  const color = (query.type && types?.get(query.type)?.color) || "#6c757d";
                  return (
                    <tr
                      key={query.id}
                      tabIndex={0}
                      onClick={() => open(query)}
                      onKeyDown={(e) => e.key === "Enter" && open(query)}
                      aria-label={`Open query ${query.label || query.id}`}
                    >
                      <td className="text-nowrap">
                        <FontAwesomeIcon icon={faCircle} className="query-type-dot me-2" style={{ color }} />
                        {query.type ? label(query.type) : "Unknown type"}
                      </td>
                      <td className="query-home-title">{query.label || <span className="text-muted">Untitled</span>}</td>
                      <td>{query.description}</td>
                      <td>{spaceLabel(space, query.space)}</td>
                      <td className="text-nowrap">
                        <FontAwesomeIcon icon={faGlasses} className="me-2" title="Can view" />
                        <span className="visually-hidden">Can view</span>
                        {space?.canWrite && (
                          <>
                            <FontAwesomeIcon icon={faPen} title="Can edit" />
                            <span className="visually-hidden">Can edit</span>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          </div>
        </>
      )}
    </div>
  );
}
