import React from "react";

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * A timestamp in the locale of the user - the exact (ISO) value is shown as tooltip. The fallback is shown if there is
 * no (valid) value.
 */
export function Timestamp({
  value,
  fallback,
}: {
  value?: string;
  fallback: React.ReactNode;
}) {
  const date = value ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) {
    return <>{fallback}</>;
  }
  return (
    <time dateTime={value} title={value}>
      {DATE_FORMAT.format(date)}
    </time>
  );
}
