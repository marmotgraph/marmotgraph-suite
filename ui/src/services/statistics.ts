import { getJson } from "./http";

export interface StatisticsTotals {
  instances: number;
  /** The number of property occurrences. */
  triples: number;
}

export interface TypeStatistics {
  identifier: string;
  name: string;
  color?: string | null;
  /** The live instances of the type - an embedded type counts the instances containing it. */
  liveInstances: number;
  releasedInstances: number;
}

/** The live instances a validation schema name applies to (across types) - each one is in exactly one of the groups. */
export interface ValidationStatistics {
  schema: string;
  types: number;
  instances: number;
  fullyCompliant: number;
  above80Percent: number;
  between40And80Percent: number;
  below40Percent: number;
  notCompliant: number;
  notAssessed: number;
}

export interface GraphStatistics {
  live: StatisticsTotals;
  released: StatisticsTotals;
  /** The most occurring first. */
  types: TypeStatistics[];
  validation: ValidationStatistics[];
}

/** Fetches the key figures of the graph - the core restricts them to the spaces the user can read. */
export function fetchStatistics(accessToken: string): Promise<GraphStatistics> {
  return getJson("/api/statistics", "the statistics", accessToken);
}
