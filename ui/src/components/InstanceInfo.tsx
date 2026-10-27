import React, { useEffect, useState } from "react";
import { Alert, Button, Spinner } from "react-bootstrap";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchInstanceInformation,
  InstanceInformation,
} from "../services/instances";
import "./InstanceInfo.css";

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** A timestamp in the locale of the user - the exact (ISO) value is shown as tooltip. */
function Timestamp({ value, fallback }: { value?: string; fallback: string }) {
  const date = value ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) {
    return <span className="instance-info-empty">{fallback}</span>;
  }
  return (
    <time dateTime={value} title={value}>
      {DATE_FORMAT.format(date)}
    </time>
  );
}

/**
 * Shows the administrative information of an instance: when it was created, last modified and (first / last)
 * released - and the users who have contributed to it.
 */
export default function InstanceInfo({ instanceId }: { instanceId: string }) {
  const { getAccessToken } = useAuth();
  const [info, setInfo] = useState<InstanceInformation>();
  const [loadError, setLoadError] = useState<string>();
  /** Incremented to load the information again (after a failure) */
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then((token) => fetchInstanceInformation(token, instanceId))
      .then((loaded) => !cancelled && setInfo(loaded))
      .catch((e: unknown) => {
        console.error("Failed to load the information of the instance", e);
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, instanceId, reloadCount]);

  if (loadError && !info) {
    return (
      <Alert variant="danger">
        {loadError}
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline-danger"
            onClick={() => {
              setLoadError(undefined);
              setReloadCount((count) => count + 1);
            }}
          >
            Retry
          </Button>
        </div>
      </Alert>
    );
  }

  if (!info) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" role="status" className="me-2" />
        Loading information...
      </div>
    );
  }

  const timestamps: Array<{ label: string; value?: string; fallback: string }> = [
    { label: "Last modified", value: info.lastModified, fallback: "Unknown" },
    { label: "Last released", value: info.lastReleased, fallback: "Never released" },
    { label: "First released", value: info.firstReleased, fallback: "Never released" },
    { label: "Created", value: info.createdAt, fallback: "Unknown" },
  ];

  return (
    <div className="instance-view instance-info">
      <dl className="instance-info-timestamps">
        {timestamps.map(({ label, value, fallback }) => (
          <div key={label} className="instance-info-item">
            <dt className="view-label">{label}</dt>
            <dd className="view-value">
              <Timestamp value={value} fallback={fallback} />
            </dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="instance-info-contributors">
        <h3 id="instance-info-contributors" className="view-label">
          Contributors
          <span className="instance-info-count">{info.contributors.length}</span>
        </h3>
        {info.contributors.length === 0 ? (
          <p className="instance-info-empty">No contributors known.</p>
        ) : (
          <ul className="instance-info-contributors">
            {info.contributors.map((contributor) => (
              <li
                key={contributor.username}
                className="tag-badge"
                title={contributor.username}
              >
                {contributor.name}
                {contributor.name !== contributor.username && (
                  <span className="instance-info-username">
                    {contributor.username}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
