import React from "react";
import { Search } from "lucide-react";
import "./SearchEmptyState.css";

type SearchEmptyStateProps = {
  variant: "initial" | "no-results";
  query?: string;
};

export function SearchEmptyState({ variant, query }: SearchEmptyStateProps) {
  if (variant === "no-results") {
    return (
      <div className="search-empty" role="status">
        <Search size={32} strokeWidth={1.5} aria-hidden="true" />
        <h3>No results found</h3>
        <p>
          No instances match
          {query ? (
            <>
              {" "}
              <strong>&ldquo;{query}&rdquo;</strong>
            </>
          ) : (
            " your filters"
          )}
          . Try different keywords or adjust your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="search-empty" role="status">
      <Search size={32} strokeWidth={1.5} aria-hidden="true" />
      <h3>Search the knowledge graph</h3>
      <p>
        Enter a name, ID, type, or space to find instances. Use the filter
        panel to narrow results by type or space.
      </p>
    </div>
  );
}
