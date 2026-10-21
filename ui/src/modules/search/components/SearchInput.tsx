import React, { useId } from "react";
import { Search, X } from "lucide-react";
import "./SearchInput.css";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onClear?: () => void;
  placeholder?: string;
};

export function SearchInput({
  value,
  onChange,
  onSearch,
  onClear,
  placeholder = "Search instances, types, spaces…",
}: SearchInputProps) {
  const inputId = useId();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSearch();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && value) {
      onClear?.();
    }
  };

  return (
    <form className="search-input-form" onSubmit={handleSubmit} role="search">
      <label htmlFor={inputId} className="visually-hidden">
        Search the knowledge graph
      </label>
      <div className="search-input-bar">
        <Search
          className="search-input-icon"
          size={18}
          strokeWidth={2}
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          className="search-input-field"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
        />
        {value && onClear && (
          <button
            type="button"
            className="search-input-clear"
            onClick={onClear}
            aria-label="Clear search query"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
        <button type="submit" className="search-input-submit">
          Search
        </button>
      </div>
    </form>
  );
}
