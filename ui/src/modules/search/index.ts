/**
 * Search module public API.
 * Import from this barrel when integrating; detach by moving this folder as a unit.
 */
export { default as SearchHome } from "./SearchHome";
export { searchSubNav } from "./searchSubNav";
export { useSearch } from "./hooks/useSearch";
export type {
  FacetOption,
  SearchFilters,
  SearchResult,
  SearchSort,
  SearchSortDirection,
  SearchSortField,
  SearchState,
  SearchViewMode,
} from "./types/searchTypes";
export {
  SEARCH_AVAILABLE_SPACES,
  SEARCH_AVAILABLE_TYPES,
  SEARCH_MOCK_RESULTS,
  SEARCH_PAGE_SIZE,
  SEARCH_SUGGESTIONS,
  SEARCH_TYPE_COLORS,
} from "./data/searchMockData";
