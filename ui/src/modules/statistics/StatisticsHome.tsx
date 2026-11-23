import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, ProgressBar, Table } from "react-bootstrap";
import { useAuth } from "../../contexts/AuthContext";
import {
  BulkValidationStatus,
  ComplianceCounts,
  fetchStatistics,
  fetchValidationStatus,
  GraphStatistics,
  StatisticsTotals,
  TypeValidationStatistics,
  ValidationStatistics,
} from "../../services/statistics";
import "./Statistics.css";

/** The number of types shown until the user asks for all of them. */
const MOST_OCCURRING_TYPES = 10;

/** How often the status of the validation of all instances is checked while it runs - and while it doesn't. */
export const VALIDATION_POLL_INTERVAL = { running: 3000, idle: 30000 };

/** The color of a type without one. */
const NEUTRAL_TYPE_COLOR = "#6c757d";

type ComplianceGroup = {
  key: keyof Pick<
    ComplianceCounts,
    | "fullyCompliant"
    | "above80Percent"
    | "between40And80Percent"
    | "below40Percent"
    | "notCompliant"
    | "notAssessed"
  >;
  label: string;
  /** Only shown if there are instances in the group. */
  optional?: boolean;
};

/** From compliant to not compliant - the colors of the groups are defined in Statistics.css. */
const COMPLIANCE_GROUPS: ComplianceGroup[] = [
  { key: "fullyCompliant", label: "Fully compliant" },
  { key: "above80Percent", label: "Almost fully compliant (>80%)" },
  { key: "between40And80Percent", label: "40–80%" },
  { key: "below40Percent", label: ">0–<40%" },
  { key: "notCompliant", label: "Not compliant" },
  { key: "notAssessed", label: "Not assessed", optional: true },
];

function formatCount(count: number) {
  return count.toLocaleString();
}

function plural(count: number, noun: string) {
  return `${formatCount(count)} ${noun}${count === 1 ? "" : "s"}`;
}

/** The share in percent - a small group never reads as 0% and an incomplete one never as 100%. */
export function formatShare(count: number, total: number) {
  if (total === 0 || count === 0) {
    return "0%";
  }
  const share = (100 * count) / total;
  if (share < 1) {
    return "<1%";
  }
  if (share > 99 && count < total) {
    return ">99%";
  }
  return `${Math.round(share)}%`;
}

function TotalsCard({
  title,
  metric,
  live,
  released,
}: Readonly<{
  title: string;
  metric: keyof StatisticsTotals;
  live?: StatisticsTotals;
  released?: StatisticsTotals;
}>) {
  return (
    <section className="statistics-card" aria-labelledby={`statistics-${metric}`}>
      <h3 className="statistics-kicker" id={`statistics-${metric}`}>
        {title}
      </h3>
      <dl className="statistics-figures">
        <div>
          <dt className="statistics-figure-label">Live</dt>
          <dd className="statistics-figure">{live ? formatCount(live[metric]) : "–"}</dd>
        </div>
        <div>
          <dt className="statistics-figure-label">Released</dt>
          <dd className="statistics-figure">{released ? formatCount(released[metric]) : "–"}</dd>
        </div>
      </dl>
    </section>
  );
}

function MostOccurringTypes({ types }: Readonly<{ types: GraphStatistics["types"] }>) {
  const [showAll, setShowAll] = useState(false);
  if (types.length === 0) {
    return <p className="statistics-empty text-muted">There are no instances yet.</p>;
  }
  const shown = showAll ? types : types.slice(0, MOST_OCCURRING_TYPES);
  const largest = Math.max(...types.map((t) => t.liveInstances), 1);
  return (
    <>
      <Table responsive className="statistics-table">
        <thead>
          <tr>
            <th>Type</th>
            <th className="statistics-bar-cell">
              <span className="visually-hidden">Live instances compared to the most occurring type</span>
            </th>
            <th className="statistics-number">Live</th>
            <th className="statistics-number">Released</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((type) => (
            <tr key={type.identifier}>
              <td>
                <span
                  className="statistics-type-dot"
                  style={{ backgroundColor: type.color || NEUTRAL_TYPE_COLOR }}
                  aria-hidden="true"
                />
                <span title={type.identifier}>{type.name}</span>
              </td>
              <td className="statistics-bar-cell" aria-hidden="true">
                <div
                  className="statistics-type-bar"
                  style={{ width: `${(100 * type.liveInstances) / largest}%` }}
                />
              </td>
              <td className="statistics-number">{formatCount(type.liveInstances)}</td>
              <td className="statistics-number">{formatCount(type.releasedInstances)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {types.length > MOST_OCCURRING_TYPES && (
        <Button variant="link" size="sm" className="statistics-show-all" onClick={() => setShowAll(!showAll)}>
          {showAll ? `Show the top ${MOST_OCCURRING_TYPES}` : `Show all ${types.length} types`}
        </Button>
      )}
    </>
  );
}

/** The groups shown for the given counts - an optional group only if it has instances. */
function shownGroups(counts: ComplianceCounts) {
  return COMPLIANCE_GROUPS.filter((g) => !g.optional || counts[g.key] > 0);
}

function describeGroup(g: ComplianceGroup, counts: ComplianceCounts) {
  return `${g.label}: ${plural(counts[g.key], "instance")} (${formatShare(counts[g.key], counts.instances)})`;
}

/** The instances as one bar with a segment per group - groups without instances don't get one. */
function ComplianceBar({ counts, label, small }: Readonly<{ counts: ComplianceCounts; label?: string; small?: boolean }>) {
  const groups = shownGroups(counts);
  const description = groups.map((g) => describeGroup(g, counts)).join(", ");
  return (
    <div
      className={`statistics-compliance-bar${small ? " statistics-compliance-bar--small" : ""}`}
      role="img"
      aria-label={label ? `${label}: ${description}` : description}
    >
      {groups
        .filter((g) => counts[g.key] > 0)
        .map((g) => (
          <div
            key={g.key}
            className={`statistics-compliance-group--${g.key}`}
            style={{ flexGrow: counts[g.key] }}
            title={describeGroup(g, counts)}
          />
        ))}
    </div>
  );
}

/** The compliance of the instances of a schema per type - the type with the most instances first. */
function ComplianceByType({
  types,
  colors,
}: Readonly<{ types: TypeValidationStatistics[]; colors: Map<string, string | null | undefined> }>) {
  return (
    <Table responsive className="statistics-table statistics-compliance-types">
      <thead>
        <tr>
          <th>Type</th>
          <th className="statistics-bar-cell">Compliance</th>
          <th className="statistics-number">Instances</th>
          <th className="statistics-number">Fully compliant</th>
        </tr>
      </thead>
      <tbody>
        {types.map((type) => (
          <tr key={type.identifier}>
            <td>
              <span
                className="statistics-type-dot"
                style={{ backgroundColor: colors.get(type.identifier) || NEUTRAL_TYPE_COLOR }}
                aria-hidden="true"
              />
              <span title={type.identifier}>{type.name}</span>
            </td>
            <td className="statistics-bar-cell">
              <ComplianceBar counts={type} label={type.name} small />
            </td>
            <td className="statistics-number">{formatCount(type.instances)}</td>
            <td className="statistics-number">
              {formatCount(type.fullyCompliant)}
              <span className="statistics-share">{formatShare(type.fullyCompliant, type.instances)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function SchemaCompliance({
  schema,
  colors,
}: Readonly<{ schema: ValidationStatistics; colors: Map<string, string | null | undefined> }>) {
  const [showTypes, setShowTypes] = useState(false);
  const groups = shownGroups(schema);
  const perType = schema.perType ?? [];
  return (
    <article className="statistics-card statistics-schema">
      <header className="statistics-schema-header">
        <h4 className="statistics-schema-name">{schema.schema}</h4>
        <span className="statistics-meta">
          {plural(schema.instances, "instance")} · {plural(schema.types, "type")}
        </span>
      </header>
      <ComplianceBar counts={schema} />
      <dl className="statistics-compliance-legend">
        {groups.map((g) => (
          <div key={g.key}>
            <dt>
              <span className={`statistics-swatch statistics-compliance-group--${g.key}`} aria-hidden="true" />
              {g.label}
            </dt>
            <dd className={schema[g.key] === 0 ? "statistics-none" : undefined}>
              {formatCount(schema[g.key])}
              <span className="statistics-share">{formatShare(schema[g.key], schema.instances)}</span>
            </dd>
          </div>
        ))}
      </dl>
      {perType.length > 0 && (
        <div className="statistics-schema-types">
          <Button
            variant="link"
            size="sm"
            className="statistics-show-all"
            aria-expanded={showTypes}
            onClick={() => setShowTypes(!showTypes)}
          >
            {showTypes ? "Hide the compliance per type" : `Show the compliance per type (${perType.length})`}
          </Button>
          {showTypes && <ComplianceByType types={perType} colors={colors} />}
        </div>
      )}
    </article>
  );
}

/**
 * Keeps track of the validation of all instances - checked often while it runs and rarely otherwise. The callback is
 * invoked when a validation finishes while the page is open. Without the status (e.g. a failed request) there is no
 * indication - the statistics stay usable without it.
 */
function useValidationStatus(onFinished: (status: BulkValidationStatus) => void) {
  const { getAccessToken } = useAuth();
  const [status, setStatus] = useState<BulkValidationStatus>();
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wasRunning = false;
    const poll = () => {
      getAccessToken()
        .then(fetchValidationStatus)
        .then((s) => {
          if (!current) {
            return;
          }
          const running = s.state === "RUNNING";
          setStatus(s);
          if (wasRunning && !running) {
            finished.current(s);
          }
          wasRunning = running;
          timer = setTimeout(poll, running ? VALIDATION_POLL_INTERVAL.running : VALIDATION_POLL_INTERVAL.idle);
        })
        .catch(() => current && setStatus(undefined));
    };
    poll();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [getAccessToken]);
  return status;
}

function formatTime(timestamp?: string | null) {
  return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined;
}

/** The progress of a running validation of all instances. */
function ValidationProgress({ status }: Readonly<{ status: BulkValidationStatus }>) {
  const percent = status.total > 0 ? Math.min(100, Math.floor((100 * status.processed) / status.total)) : 0;
  const started = formatTime(status.startedAt);
  return (
    <section className="statistics-card statistics-validation-progress" role="status" aria-label="Validation in progress">
      <div className="statistics-validation-progress-header">
        <span className="statistics-validation-progress-title">
          Validating {status.space ? `the instances of ${status.space}` : "all instances"}
        </span>
        <span className="statistics-meta">
          {status.total > 0
            ? `${formatCount(status.processed)} of ${plural(status.total, "instance")} · ${percent}%`
            : "Preparing…"}
        </span>
      </div>
      <ProgressBar
        animated
        now={percent}
        className="statistics-validation-progress-bar"
        aria-label="Validated instances"
      />
      <p className="statistics-note">
        {started && `Started at ${started}. `}The figures below are updated when the validation has finished.
      </p>
    </section>
  );
}

/** A dashboard with the key figures of the graph. */
export default function StatisticsHome() {
  const { getAccessToken } = useAuth();
  const [statistics, setStatistics] = useState<GraphStatistics>();
  const [error, setError] = useState<string>();
  /** Increased to load the statistics again - e.g. once a validation has finished. */
  const [version, setVersion] = useState(0);
  const [validationFailure, setValidationFailure] = useState<string>();
  const validation = useValidationStatus((s) => {
    setValidationFailure(s.state === "FAILED" ? `The validation of the instances failed${s.error ? `: ${s.error}` : "."}` : undefined);
    setVersion((v) => v + 1);
  });

  useEffect(() => {
    let current = true;
    getAccessToken()
      .then(fetchStatistics)
      .then((s) => {
        if (current) {
          setStatistics(s);
          setError(undefined);
        }
      })
      .catch((e: Error) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [getAccessToken, version]);

  const colors = new Map(statistics?.types.map((t) => [t.identifier, t.color]));

  const loading = !statistics && !error;
  return (
    <div className="statistics-home" aria-busy={loading}>
      <p className="statistics-meta">These figures only cover the spaces you can read.</p>
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="statistics-totals">
        <TotalsCard title="Instances" metric="instances" live={statistics?.live} released={statistics?.released} />
        <TotalsCard title="Triples" metric="triples" live={statistics?.live} released={statistics?.released} />
      </div>

      {statistics && (
        <>
          <section aria-labelledby="statistics-types">
            <div className="statistics-section-header">
              <h3 className="statistics-kicker" id="statistics-types">
                Most occurring types
              </h3>
              <span className="statistics-meta">{plural(statistics.types.length, "type")}</span>
            </div>
            <MostOccurringTypes types={statistics.types} />
            {statistics.types.length > 0 && (
              <p className="statistics-note">
                An embedded type counts the instances containing it, so the types can add up to more than the total.
              </p>
            )}
          </section>

          <section aria-labelledby="statistics-validation">
            <div className="statistics-section-header">
              <h3 className="statistics-kicker" id="statistics-validation">
                Instances by validation schema
              </h3>
              <span className="statistics-meta">{plural(statistics.validation.length, "schema")}</span>
            </div>
            {validation?.state === "RUNNING" && <ValidationProgress status={validation} />}
            {validationFailure && (
              <Alert variant="warning" dismissible onClose={() => setValidationFailure(undefined)}>
                {validationFailure}
              </Alert>
            )}
            {statistics.validation.length === 0 ? (
              <p className="statistics-empty text-muted">No validation schema applies to these instances.</p>
            ) : (
              <>
                {statistics.validation.map((schema) => (
                  <SchemaCompliance key={schema.schema} schema={schema} colors={colors} />
                ))}
                <p className="statistics-note">
                  Validation only covers live instances. Percentages are the share of the properties of the schema an
                  invalid instance fulfills.
                  {statistics.validation.some((s) => s.notAssessed > 0) &&
                    " Not assessed instances have not been validated against the schema yet, or their result has no score."}
                </p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
