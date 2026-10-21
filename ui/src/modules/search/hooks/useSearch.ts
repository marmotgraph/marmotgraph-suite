import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SEARCH_AVAILABLE_SPACES,
  SEARCH_AVAILABLE_TYPES,
  SEARCH_MOCK_RESULTS,
  SEARCH_PAGE_SIZE,
} from "../data/searchMockData";
import type {
  FacetOption,
  SearchFilters,
  SearchResult,
  SearchSort,
  SearchSortField,
  SearchViewMode,
} from "../types/searchTypes";

function matchesQuery(result: SearchResult, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") return true;

  return (
    result.name.toLowerCase().includes(normalized) ||
    result.id.toLowerCase().includes(normalized) ||
    result.type.toLowerCase().includes(normalized) ||
    result.space.toLowerCase().includes(normalized) ||
    (result.description?.toLowerCase().includes(normalized) ?? false)
  );
}

function compareResults(
  left: SearchResult,
  right: SearchResult,
  sort: SearchSort,
): number {
  const direction = sort.direction === "asc" ? 1 : -1;

  switch (sort.field) {
    case "name":
      return left.name.localeCompare(right.name) * direction;
    case "type":
      return left.type.localeCompare(right.type) * direction;
    case "lastModified":
      return (
        (left.lastModified ?? "").localeCompare(right.lastModified ?? "") *
        direction
      );
    case "relevance":
    default:
      return left.name.localeCompare(right.name) * direction;
  }
}

function countFacets(
  pool: SearchResult[],
  key: "type" | "space",
  options: readonly string[],
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const option of options) counts.set(option, 0);
  for (const item of pool) {
    counts.set(item[key], (counts.get(item[key]) ?? 0) + 1);
  }
  return options.map((value) => ({ value, count: counts.get(value) ?? 0 }));
}

export type UseSearchOptions = {
  results?: SearchResult[];
  availableTypes?: readonly string[];
  availableSpaces?: readonly string[];
  pageSize?: number;
};

export function useSearch(options: UseSearchOptions = {}) {
  const {
    results = SEARCH_MOCK_RESULTS,
    availableTypes = SEARCH_AVAILABLE_TYPES,
    availableSpaces = SEARCH_AVAILABLE_SPACES,
    pageSize = SEARCH_PAGE_SIZE,
  } = options;

  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [searchExecuted, setSearchExecuted] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    types: [],
    spaces: [],
  });
  const [sort, setSort] = useState<SearchSort>({
    field: "relevance",
    direction: "asc",
  });
  const [viewMode, setViewMode] = useState<SearchViewMode>("list");
  const [itemsToShow, setItemsToShow] = useState(pageSize);
  const [typeFacetSearch, setTypeFacetSearch] = useState("");
  const [spaceFacetSearch, setSpaceFacetSearch] = useState("");

  const executeSearch = useCallback(() => {
    setActiveQuery(query);
    setSearchExecuted(true);
    setItemsToShow(pageSize);
  }, [pageSize, query]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setActiveQuery("");
    setSearchExecuted(false);
    setItemsToShow(pageSize);
  }, [pageSize]);

  const applySuggestion = useCallback(
    (suggestion: string) => {
      setQuery(suggestion);
      setActiveQuery(suggestion);
      setSearchExecuted(true);
      setItemsToShow(pageSize);
    },
    [pageSize],
  );

  const toggleTypeFilter = useCallback((type: string) => {
    setFilters((prev) => {
      const types = prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type];
      return { ...prev, types };
    });
    setItemsToShow(pageSize);
  }, [pageSize]);

  const toggleSpaceFilter = useCallback((space: string) => {
    setFilters((prev) => {
      const spaces = prev.spaces.includes(space)
        ? prev.spaces.filter((s) => s !== space)
        : [...prev.spaces, space];
      return { ...prev, spaces };
    });
    setItemsToShow(pageSize);
  }, [pageSize]);

  const removeFilter = useCallback(
    (dimension: "types" | "spaces", value: string) => {
      setFilters((prev) => ({
        ...prev,
        [dimension]: prev[dimension].filter((item) => item !== value),
      }));
      setItemsToShow(pageSize);
    },
    [pageSize],
  );

  const clearFilters = useCallback(() => {
    setFilters({ types: [], spaces: [] });
    setItemsToShow(pageSize);
  }, [pageSize]);

  const setSortField = useCallback((field: SearchSortField) => {
    setSort((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { field, direction: "asc" };
    });
  }, []);

  const setSortFromSelect = useCallback((value: string) => {
    const [field, direction] = value.split(":") as [
      SearchSortField,
      "asc" | "desc",
    ];
    setSort({ field, direction });
  }, []);

  const loadMore = useCallback(() => {
    setItemsToShow((prev) => prev + pageSize);
  }, [pageSize]);

  useEffect(() => {
    setItemsToShow(pageSize);
  }, [activeQuery, filters, pageSize]);

  const queryMatched = useMemo(
    () => results.filter((item) => matchesQuery(item, activeQuery)),
    [activeQuery, results],
  );

  const typeFacetPool = useMemo(() => {
    let pool = queryMatched;
    if (filters.spaces.length > 0) {
      pool = pool.filter((item) => filters.spaces.includes(item.space));
    }
    return pool;
  }, [filters.spaces, queryMatched]);

  const spaceFacetPool = useMemo(() => {
    let pool = queryMatched;
    if (filters.types.length > 0) {
      pool = pool.filter((item) => filters.types.includes(item.type));
    }
    return pool;
  }, [filters.types, queryMatched]);

  const typeFacets = useMemo(
    () => countFacets(typeFacetPool, "type", availableTypes),
    [availableTypes, typeFacetPool],
  );

  const spaceFacets = useMemo(
    () => countFacets(spaceFacetPool, "space", availableSpaces),
    [availableSpaces, spaceFacetPool],
  );

  const filteredResults = useMemo(() => {
    let result = [...queryMatched];

    if (filters.types.length > 0) {
      result = result.filter((item) => filters.types.includes(item.type));
    }

    if (filters.spaces.length > 0) {
      result = result.filter((item) => filters.spaces.includes(item.space));
    }

    return result.sort((a, b) => compareResults(a, b, sort));
  }, [filters, queryMatched, sort]);

  const visibleResults = useMemo(
    () => filteredResults.slice(0, itemsToShow),
    [filteredResults, itemsToShow],
  );

  const hasMore = visibleResults.length < filteredResults.length;

  const hasActiveFilters =
    filters.types.length > 0 || filters.spaces.length > 0;
  const hasSearched = searchExecuted || hasActiveFilters;

  const sortSelectValue = `${sort.field}:${sort.direction}`;

  return {
    query,
    setQuery,
    activeQuery,
    filters,
    sort,
    sortSelectValue,
    viewMode,
    setViewMode,
    typeFacetSearch,
    setTypeFacetSearch,
    spaceFacetSearch,
    setSpaceFacetSearch,
    typeFacets,
    spaceFacets,
    results: visibleResults,
    totalCount: filteredResults.length,
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
    setSortField,
    setSortFromSelect,
    loadMore,
  };
}
