import React, { useId } from "react";
import { LayoutGrid, List } from "lucide-react";
import type { SearchViewMode } from "../types/searchTypes";
import "./SearchToolbar.css";

type SearchToolbarProps = {
  totalCount: number;
  activeQuery: string;
  sortSelectValue: string;
  onSortChange: (value: string) => void;
  viewMode: SearchViewMode;
  onViewModeChange: (mode: SearchViewMode) => void;
};

const SORT_OPTIONS = [
  { value: "relevance:asc", label: "Relevance" },
  { value: "name:asc", label: "Name (A–Z)" },
  { value: "name:desc", label: "Name (Z–A)" },
  { value: "type:asc", label: "Type" },
  { value: "lastModified:desc", label: "Recently modified" },
];

export function SearchToolbar({
  totalCount,
  activeQuery,
  sortSelectValue,
  onSortChange,
  viewMode,
  onViewModeChange,
}: SearchToolbarProps) {
  const sortId = useId();

  return (
    <div className="search-toolbar">
      <p className="search-result-count" role="status" aria-live="polite">
        <strong>{totalCount}</strong>
        <span>
          {totalCount === 1 ? " result" : " results"}
          {activeQuery && (
            <span className="search-result-for">
              {" "}
              for &ldquo;{activeQuery}&rdquo;
            </span>
          )}
        </span>
      </p>

      <div className="search-toolbar-tools">
        <div className="search-tool-select">
          <label htmlFor={sortId}>Sort by</label>
          <select
            id={sortId}
            value={sortSelectValue}
            onChange={(event) => onSortChange(event.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div
          className="search-view-toggle"
          role="group"
          aria-label="Results view"
        >
          <button
            type="button"
            className={viewMode === "list" ? "on" : ""}
            onClick={() => onViewModeChange("list")}
            aria-pressed={viewMode === "list"}
            aria-label="List view"
          >
            <List size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={viewMode === "grid" ? "on" : ""}
            onClick={() => onViewModeChange("grid")}
            aria-pressed={viewMode === "grid"}
            aria-label="Grid view"
          >
            <LayoutGrid size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
