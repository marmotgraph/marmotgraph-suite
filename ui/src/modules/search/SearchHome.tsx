import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SearchAppliedFilters } from "./components/SearchAppliedFilters";
import { SearchEmptyState } from "./components/SearchEmptyState";
import { SearchFilterRail } from "./components/SearchFilterRail";
import { SearchInput } from "./components/SearchInput";
import { SearchResultsList } from "./components/SearchResultsList";
import { SearchSuggestions } from "./components/SearchSuggestions";
import { SearchToolbar } from "./components/SearchToolbar";
import { SEARCH_SUGGESTIONS } from "./data/searchMockData";
import { useSearch } from "./hooks/useSearch";
import type { SearchResult } from "./types/searchTypes";
import "./theme/searchTheme.css";
import "./SearchHome.css";

export default function SearchHome() {
  const navigate = useNavigate();

  const {
    query,
    setQuery,
    activeQuery,
    filters,
    sortSelectValue,
    viewMode,
    setViewMode,
    typeFacetSearch,
    setTypeFacetSearch,
    spaceFacetSearch,
    setSpaceFacetSearch,
    typeFacets,
    spaceFacets,
    results,
    totalCount,
    hasMore,
    hasSearched,
    hasActiveFilters,
    executeSearch,
    clearSearch,
    applySuggestion,
    toggleTypeFilter,
    toggleSpaceFilter,
    removeFilter,
    clearFilters,
    setSortFromSelect,
    loadMore,
  } = useSearch();

  const handleResultSelect = useCallback(
    (result: SearchResult) => {
      navigate(`/editor/instance/${result.id}`);
    },
    [navigate],
  );

  const handleClearQuery = useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  return (
    <div className="search-module search-home">
      <section className="search-home-band" aria-label="Search">
        <div className="search-home-band-inner">
          <h1 className="search-home-title">Search the Knowledge Graph</h1>
          <SearchInput
            value={query}
            onChange={setQuery}
            onSearch={executeSearch}
            onClear={query ? handleClearQuery : undefined}
          />
          <SearchSuggestions
            suggestions={SEARCH_SUGGESTIONS}
            onSelect={applySuggestion}
          />
        </div>
      </section>

      <div className="search-home-body">
        <SearchFilterRail
          typeFacets={typeFacets}
          spaceFacets={spaceFacets}
          selectedTypes={filters.types}
          selectedSpaces={filters.spaces}
          typeFacetSearch={typeFacetSearch}
          spaceFacetSearch={spaceFacetSearch}
          onTypeFacetSearchChange={setTypeFacetSearch}
          onSpaceFacetSearchChange={setSpaceFacetSearch}
          onToggleType={toggleTypeFilter}
          onToggleSpace={toggleSpaceFilter}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <div className="search-home-results-col">
          {hasActiveFilters && (
            <SearchAppliedFilters
              filters={filters}
              onRemove={removeFilter}
              onClearAll={clearFilters}
            />
          )}

          {hasSearched && (
            <SearchToolbar
              totalCount={totalCount}
              activeQuery={activeQuery}
              sortSelectValue={sortSelectValue}
              onSortChange={setSortFromSelect}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          )}

          {!hasSearched && <SearchEmptyState variant="initial" />}

          {hasSearched && totalCount === 0 && (
            <SearchEmptyState variant="no-results" query={activeQuery} />
          )}

          {hasSearched && totalCount > 0 && (
            <SearchResultsList
              results={results}
              viewMode={viewMode}
              onResultSelect={handleResultSelect}
              hasMore={hasMore}
              onLoadMore={loadMore}
              totalCount={totalCount}
            />
          )}
        </div>
      </div>
    </div>
  );
}
