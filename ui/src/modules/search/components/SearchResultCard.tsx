import React from "react";
import { ExternalLink } from "lucide-react";
import { SEARCH_TYPE_COLORS } from "../data/searchMockData";
import type { SearchResult } from "../types/searchTypes";
import "./SearchResultCard.css";

type SearchResultCardProps = {
  result: SearchResult;
  viewMode: "list" | "grid";
  onSelect?: (result: SearchResult) => void;
};

export function SearchResultCard({
  result,
  viewMode,
  onSelect,
}: SearchResultCardProps) {
  const typeColor = SEARCH_TYPE_COLORS[result.type] ?? "#2b6cb0";

  const handleClick = () => onSelect?.(result);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(result);
    }
  };

  return (
    <article
      className={`search-result-card${viewMode === "grid" ? " search-result-card--grid" : ""}${onSelect ? " search-result-card--interactive" : ""}`}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? handleClick : undefined}
      onKeyDown={onSelect ? handleKeyDown : undefined}
      aria-label={`${result.name}, ${result.type}, space ${result.space}`}
    >
      <div
        className="search-result-card-accent"
        style={{ background: typeColor }}
        aria-hidden="true"
      />

      <div
        className="search-result-card-thumb"
        style={
          {
            "--search-card-type-color": typeColor,
          } as React.CSSProperties
        }
        aria-hidden="true"
      >
        <span className="search-result-card-thumb-type">{result.type}</span>
        <span className="search-result-card-thumb-id">{result.id}</span>
      </div>

      <div className="search-result-card-main">
        <div className="search-result-card-top">
          <span
            className="search-result-card-badge"
            style={{ color: typeColor }}
          >
            {result.type}
          </span>
          {result.lastModified && (
            <time
              className="search-result-card-date"
              dateTime={result.lastModified}
            >
              {result.lastModified}
            </time>
          )}
        </div>

        <h3 className="search-result-card-title">{result.name}</h3>

        {result.description && (
          <p className="search-result-card-desc">{result.description}</p>
        )}

        <div className="search-result-card-meta">
          <span className="search-result-card-mchip">{result.space}</span>
          <span className="search-result-card-mchip">{result.id}</span>
        </div>

        <footer className="search-result-card-foot">
          <span className="search-result-card-foot-stat">
            Instance in {result.space}
          </span>
          <span className="search-result-card-foot-spacer" aria-hidden="true" />
          {onSelect && (
            <span className="search-result-card-cta">
              View
              <ExternalLink size={14} aria-hidden="true" />
            </span>
          )}
        </footer>
      </div>
    </article>
  );
}
