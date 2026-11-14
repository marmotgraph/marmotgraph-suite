import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Form } from "react-bootstrap";
import type { TypeSummary } from "./graphModel";

/** Searching only pays off once the list is long enough to scan by eye. */
export const SEARCH_FROM = 8;

interface TypeFilterProps {
  types: TypeSummary[];
  hidden: ReadonlySet<string>;
  onToggle: (type: string) => void;
  /** Shows or hides all the given types at once */
  onSetVisible: (types: string[], visible: boolean) => void;
}

/**
 * Which types are shown. One checkbox switches all of them (mixed when only some are shown); with many types a
 * search narrows the list - and the checkbox then applies to what matches, so "everything about datasets" is two
 * keystrokes. It stays in the panel: the graph is in view while the types are chosen.
 */
export default function TypeFilter({ types, hidden, onToggle, onSetVisible }: TypeFilterProps) {
  const allId = useId();
  const masterRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  const searchable = types.length >= SEARCH_FROM;
  const query = searchable ? term.trim().toLowerCase() : "";

  const matching = useMemo(() => (query ? types.filter((t) => t.type.toLowerCase().includes(query)) : types), [types, query]);
  const shownCount = matching.filter((t) => !hidden.has(t.type)).length;
  const state: "all" | "some" | "none" = matching.length > 0 && shownCount === matching.length ? "all" : shownCount === 0 ? "none" : "some";

  useEffect(() => {
    if (masterRef.current) {
      masterRef.current.indeterminate = state === "some";
    }
  }, [state]);

  if (types.length === 0) {
    return <p className="viz-muted">Nothing here yet.</p>;
  }

  return (
    <>
      {searchable && (
        <Form.Control
          type="search"
          size="sm"
          value={term}
          placeholder="Filter types"
          aria-label={`Filter the ${types.length} types`}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && term) {
              e.stopPropagation();
              setTerm("");
            }
          }}
        />
      )}

      <div className="form-check viz-types-all">
        <input
          ref={masterRef}
          id={allId}
          type="checkbox"
          className="form-check-input"
          checked={state === "all"}
          disabled={matching.length === 0}
          onChange={() => onSetVisible(matching.map((t) => t.type), state !== "all")}
        />
        <label htmlFor={allId} className="form-check-label">
          {query ? `All matching` : "All types"}
        </label>
        <span className="viz-count" aria-live="polite">
          {shownCount} of {matching.length} shown
        </span>
      </div>

      {matching.length === 0 ? (
        <output className="viz-muted">
          No type matches “{term.trim()}”.
        </output>
      ) : (
        <ul className="viz-types">
          {matching.map((type) => (
            <li key={type.type}>
              <Form.Check
                type="checkbox"
                id={`viz-type-${type.type}`}
                checked={!hidden.has(type.type)}
                onChange={() => onToggle(type.type)}
                label={
                  <span className="viz-type-label">
                    <span className="viz-dot" style={{ background: type.color }} aria-hidden="true" />
                    <span className="viz-type-name" title={type.type}>
                      {type.type}
                    </span>
                    <span className="viz-count">{type.count}</span>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
