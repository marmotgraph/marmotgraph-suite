import React from "react";
import "./SearchSuggestions.css";

type SearchSuggestionsProps = {
  suggestions: readonly string[];
  onSelect: (suggestion: string) => void;
};

export function SearchSuggestions({
  suggestions,
  onSelect,
}: SearchSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="search-suggestions" role="group" aria-label="Suggested searches">
      <span className="search-suggestions-label">Try:</span>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className="search-suggestion"
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
