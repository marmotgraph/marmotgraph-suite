import React, { useId } from "react";
import { ChevronDown } from "lucide-react";
import type { SearchResult, SearchViewMode } from "../types/searchTypes";
import { SearchResultCard } from "./SearchResultCard";
import "./SearchResultsList.css";

type SearchResultsListProps = {
  results: SearchResult[];
  viewMode: SearchViewMode;
  onResultSelect?: (result: SearchResult) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  totalCount: number;
};

export function SearchResultsList({
  results,
  viewMode,
  onResultSelect,
  hasMore,
  onLoadMore,
  totalCount,
}: SearchResultsListProps) {
  const listId = useId();

  return (
    <section className="search-results" aria-labelledby={listId}>
      <h2 id={listId} className="visually-hidden">
        Search results
      </h2>

      <div
        className={`search-result-list${viewMode === "grid" ? " search-result-list--grid" : ""}`}
        role="list"
      >
        {results.map((result) => (
          <div key={result.id} className="search-result-list-item" role="listitem">
            <SearchResultCard
              result={result}
              viewMode={viewMode}
              onSelect={onResultSelect}
            />
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="search-load-more">
          <button type="button" className="search-load-more-btn" onClick={onLoadMore}>
            <ChevronDown size={16} aria-hidden="true" />
            Load more
            <span className="visually-hidden">
              , showing {results.length} of {totalCount} results
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
