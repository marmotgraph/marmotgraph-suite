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

/** Live instances by their compliance with a validation schema - each one is in exactly one of the groups. */
export interface ComplianceCounts {
  instances: number;
  fullyCompliant: number;
  above80Percent: number;
  between40And80Percent: number;
  below40Percent: number;
  notCompliant: number;
  notAssessed: number;
}

/** The compliance of the live instances of a single type with a validation schema. */
export interface TypeValidationStatistics extends ComplianceCounts {
  identifier: string;
  name: string;
}

/** The live instances a validation schema name applies to (across types). */
export interface ValidationStatistics extends ComplianceCounts {
  schema: string;
  types: number;
  /** The same groups per type - the type with the most instances first. */
  perType?: TypeValidationStatistics[];
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

/** The status of the current (or last) validation of all instances against the validation schemas of their types. */
export interface BulkValidationStatus {
  state: "IDLE" | "RUNNING" | "DONE" | "FAILED" | "UNKNOWN" | null;
  /** The space the validation is restricted to - null for all spaces. */
  space?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  total: number;
  processed: number;
  result?: { instances: number; validated: number; failed: number } | null;
  error?: string | null;
}

/** Fetches the status of the current (or last) validation of all instances - e.g. to show its progress. */
export function fetchValidationStatus(accessToken: string): Promise<BulkValidationStatus> {
  return getJson("/api/statistics/validation", "the validation status", accessToken);
}
