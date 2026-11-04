import type { InstanceSort } from "../../contexts/InstancesContext";
import type { ReleaseStatus } from "./editorMockData";
import type { InstanceSortBy, InstanceSortDirection } from "../../services/instances";

/** What the instance list shows - reflected in its URL so the same list can be opened elsewhere (e.g. in a new tab). */
export interface InstanceListState {
  searchTerm: string;
  typeFilter: string[];
  spaceFilter: string[];
  favoritesOnly: boolean;
  contributedOnly: boolean;
  releaseStatusFilter: ReleaseStatus[];
  sort: InstanceSort | null;
}

export const PREVIEW_PARAM = "preview";
const DEFAULT_SORT: InstanceSort = { by: "LAST_MODIFICATION", direction: "DESC" };
const NO_SORT = "none";
const RELEASE_STATUSES: ReleaseStatus[] = ["released", "has changed", "in progress"];
const SORT_FIELDS: InstanceSortBy[] = ["TYPE", "NAME", "LAST_MODIFICATION"];
const SORT_DIRECTIONS: InstanceSortDirection[] = ["ASC", "DESC"];

function parseSort(value: string | null): InstanceSort | null {
  if (value === NO_SORT) {
    return null;
  }
  const [by, direction] = (value ?? "").split(":") as [InstanceSortBy, InstanceSortDirection];
  return SORT_FIELDS.includes(by) && SORT_DIRECTIONS.includes(direction) ? { by, direction } : DEFAULT_SORT;
}

export function parseInstanceList(params: URLSearchParams): InstanceListState {
  return {
    searchTerm: params.get("q") ?? "",
    typeFilter: params.getAll("type"),
    spaceFilter: params.getAll("space"),
    favoritesOnly: params.get("favorites") === "1",
    contributedOnly: params.get("contributed") === "1",
    releaseStatusFilter: params.getAll("release").filter((s): s is ReleaseStatus => RELEASE_STATUSES.includes(s as ReleaseStatus)),
    sort: parseSort(params.get("sort")),
  };
}

/** The defaults are left out, so a list which isn't narrowed down has a plain URL. */
export function instanceListSearch(state: InstanceListState, previewInstanceId: string | null): string {
  const params = new URLSearchParams();
  if (state.searchTerm) {
    params.set("q", state.searchTerm);
  }
  state.typeFilter.forEach((type) => params.append("type", type));
  state.spaceFilter.forEach((space) => params.append("space", space));
  if (state.favoritesOnly) {
    params.set("favorites", "1");
  }
  if (state.contributedOnly) {
    params.set("contributed", "1");
  }
  state.releaseStatusFilter.forEach((status) => params.append("release", status));
  if (!state.sort) {
    params.set("sort", NO_SORT);
  } else if (state.sort.by !== DEFAULT_SORT.by || state.sort.direction !== DEFAULT_SORT.direction) {
    params.set("sort", `${state.sort.by}:${state.sort.direction}`);
  }
  if (previewInstanceId) {
    params.set(PREVIEW_PARAM, previewInstanceId);
  }
  return params.toString();
}
