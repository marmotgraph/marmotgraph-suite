import React, { useEffect, useState } from "react";
import { Alert, Button, Table } from "react-bootstrap";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchStatistics,
  GraphStatistics,
  StatisticsTotals,
  ValidationStatistics,
} from "../../services/statistics";
import "./Statistics.css";

/** The number of types shown until the user asks for all of them. */
const MOST_OCCURRING_TYPES = 10;

type ComplianceGroup = {
  key: keyof Pick<
    ValidationStatistics,
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
}: {
  title: string;
  metric: keyof StatisticsTotals;
  live?: StatisticsTotals;
  released?: StatisticsTotals;
}) {
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

function MostOccurringTypes({ types }: { types: GraphStatistics["types"] }) {
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
                  style={{ backgroundColor: type.color || "#6c757d" }}
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

function SchemaCompliance({ schema }: { schema: ValidationStatistics }) {
  const groups = COMPLIANCE_GROUPS.filter((g) => !g.optional || schema[g.key] > 0);
  const describe = (g: ComplianceGroup) =>
    `${g.label}: ${plural(schema[g.key], "instance")} (${formatShare(schema[g.key], schema.instances)})`;
  return (
    <article className="statistics-card statistics-schema">
      <header className="statistics-schema-header">
        <h4 className="statistics-schema-name">{schema.schema}</h4>
        <span className="statistics-meta">
          {plural(schema.instances, "instance")} · {plural(schema.types, "type")}
        </span>
      </header>
      <div
        className="statistics-compliance-bar"
        role="img"
        aria-label={groups.map(describe).join(", ")}
      >
        {groups
          .filter((g) => schema[g.key] > 0)
          .map((g) => (
            <div
              key={g.key}
              className={`statistics-compliance-group--${g.key}`}
              style={{ flexGrow: schema[g.key] }}
              title={describe(g)}
            />
          ))}
      </div>
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
    </article>
  );
}

/** A dashboard with the key figures of the graph. */
export default function StatisticsHome() {
  const { getAccessToken } = useAuth();
  const [statistics, setStatistics] = useState<GraphStatistics>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let current = true;
    getAccessToken()
      .then(fetchStatistics)
      .then((s) => current && setStatistics(s))
      .catch((e: Error) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [getAccessToken]);

  const loading = !statistics && !error;
  return (
    <div className="statistics-home" aria-busy={loading}>
      <h2>Statistics</h2>
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
            {statistics.validation.length === 0 ? (
              <p className="statistics-empty text-muted">No validation schema applies to these instances.</p>
            ) : (
              <>
                {statistics.validation.map((schema) => (
                  <SchemaCompliance key={schema.schema} schema={schema} />
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
