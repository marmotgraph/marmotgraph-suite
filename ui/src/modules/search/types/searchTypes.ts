export type SearchResult = {
  id: string;
  name: string;
  type: string;
  space: string;
  description?: string;
  lastModified?: string;
};

export type SearchFilters = {
  types: string[];
  spaces: string[];
};

export type SearchSortField = "relevance" | "name" | "type" | "lastModified";
export type SearchSortDirection = "asc" | "desc";

export type SearchSort = {
  field: SearchSortField;
  direction: SearchSortDirection;
};

export type SearchViewMode = "list" | "grid";

export type FacetOption = {
  value: string;
  count: number;
};

export type SearchState = {
  query: string;
  activeQuery: string;
  filters: SearchFilters;
  sort: SearchSort;
  viewMode: SearchViewMode;
};
