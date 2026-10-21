import React, { useId, useState } from "react";
import { ChevronDown, Filter, Search } from "lucide-react";
import type { FacetOption } from "../types/searchTypes";
import "./SearchFilterRail.css";

type FilterGroupProps = {
  title: string;
  facetSearch: string;
  onFacetSearchChange: (value: string) => void;
  facets: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
  defaultExpanded?: boolean;
};

function FilterGroup({
  title,
  facetSearch,
  onFacetSearchChange,
  facets,
  selected,
  onToggle,
  defaultExpanded = true,
}: FilterGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const normalizedSearch = facetSearch.trim().toLowerCase();

  const visibleFacets = facets.filter((facet) => {
    if (normalizedSearch === "") return true;
    return facet.value.toLowerCase().includes(normalizedSearch);
  });

  const selectedCount = selected.length;

  return (
    <div className="search-filter-group">
      <button
        type="button"
        className="search-filter-group-head"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="search-filter-group-title">{title}</span>
        <span className="search-filter-group-right">
          {selectedCount > 0 && (
            <span className="search-filter-group-count" aria-hidden="true">
              {selectedCount}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`search-filter-group-chevron${expanded ? " search-filter-group-chevron--open" : ""}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {expanded && (
        <div id={panelId} className="search-filter-group-body">
          <div className="search-facet-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={facetSearch}
              onChange={(event) => onFacetSearchChange(event.target.value)}
              placeholder={`Filter ${title.toLowerCase()}…`}
              aria-label={`Filter ${title.toLowerCase()} options`}
            />
          </div>
          <ul className="search-facet-list" role="list">
            {visibleFacets.map((facet) => {
              const isSelected = selected.includes(facet.value);
              return (
                <li key={facet.value} role="listitem">
                  <label
                    className={`search-facet${isSelected ? " search-facet--on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(facet.value)}
                    />
                    <span className="search-facet-checkbox" aria-hidden="true" />
                    <span className="search-facet-label">{facet.value}</span>
                    <span className="search-facet-num">{facet.count}</span>
                  </label>
                </li>
              );
            })}
            {visibleFacets.length === 0 && (
              <li className="search-facet-empty" role="listitem">
                No {title.toLowerCase()} match your filter
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

type SearchFilterRailProps = {
  typeFacets: FacetOption[];
  spaceFacets: FacetOption[];
  selectedTypes: string[];
  selectedSpaces: string[];
  typeFacetSearch: string;
  spaceFacetSearch: string;
  onTypeFacetSearchChange: (value: string) => void;
  onSpaceFacetSearchChange: (value: string) => void;
  onToggleType: (value: string) => void;
  onToggleSpace: (value: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

export function SearchFilterRail({
  typeFacets,
  spaceFacets,
  selectedTypes,
  selectedSpaces,
  typeFacetSearch,
  spaceFacetSearch,
  onTypeFacetSearchChange,
  onSpaceFacetSearchChange,
  onToggleType,
  onToggleSpace,
  onClearFilters,
  hasActiveFilters,
}: SearchFilterRailProps) {
  const activeFilterCount = selectedTypes.length + selectedSpaces.length;

  return (
    <aside className="search-filter-rail" aria-label="Search filters">
      <div className="search-filter-rail-head">
        <span className="search-filter-rail-title">
          <Filter size={16} aria-hidden="true" />
          Filters
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            className="search-filter-rail-clear"
            onClick={onClearFilters}
          >
            Clear
          </button>
        )}
      </div>

      <div className="search-filter-rail-scroll">
        <FilterGroup
          title="Type"
          facetSearch={typeFacetSearch}
          onFacetSearchChange={onTypeFacetSearchChange}
          facets={typeFacets}
          selected={selectedTypes}
          onToggle={onToggleType}
        />
        <FilterGroup
          title="Space"
          facetSearch={spaceFacetSearch}
          onFacetSearchChange={onSpaceFacetSearchChange}
          facets={spaceFacets}
          selected={selectedSpaces}
          onToggle={onToggleSpace}
        />
      </div>

      {activeFilterCount > 0 && (
        <p className="search-filter-rail-summary" role="status">
          {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} active
        </p>
      )}
    </aside>
  );
}
