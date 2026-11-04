import React, { useMemo, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import CodeMirror from "@uiw/react-codemirror";
import { useAuth } from "../../contexts/AuthContext";
import { jsonEditorSetup, jsonExtensions } from "../../components/jsonEditor";
import {
  QueryResult,
  QuerySpace,
  QuerySpecification,
  QueryStage,
  runQuery,
} from "../../services/queries";
import { spaceLabel } from "./useQueryBuilderData";
import "../../components/InstanceFieldControl.css";

/** The settings of a run - kept by the detail view so they survive switching between the modes. */
export interface RunSettings {
  stage: QueryStage;
  size: string;
  instanceId: string;
  filterValues: Record<string, string>;
  /** Only the instances in these spaces are returned - all readable ones if undefined */
  restrictToSpaces?: string[];
}

export const DEFAULT_RUN_SETTINGS: RunSettings = {
  stage: "RELEASED",
  size: "20",
  instanceId: "",
  filterValues: {},
};

export interface RunState {
  result?: QueryResult;
  /** The page of the result (1 based) and the markers to get back to the previous ones */
  page: number;
  markers: (string | undefined)[];
  error?: string;
}

function download(result: QueryResult) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "result.json";
  a.click();
  URL.revokeObjectURL(url);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Runs the query as currently composed (without saving it) and shows the result page by page. */
export default function QueryExecution({
  specification,
  parameterNames,
  spaces,
  isEmpty,
  settings,
  onChangeSettings,
  run,
  onChangeRun,
}: {
  specification: QuerySpecification;
  parameterNames: string[];
  spaces: QuerySpace[];
  isEmpty: boolean;
  settings: RunSettings;
  onChangeSettings: (settings: RunSettings) => void;
  run: RunState;
  onChangeRun: (run: RunState) => void;
}) {
  const { getAccessToken } = useAuth();
  const [running, setRunning] = useState(false);
  const size = Number.parseInt(settings.size, 10);
  const instanceId = settings.instanceId.trim();
  const invalidSize = !(size >= 1);
  const invalidInstanceId = !!instanceId && !UUID.test(instanceId);
  const noSpaces = settings.restrictToSpaces?.length === 0;
  const blocked = isEmpty || invalidSize || invalidInstanceId || noSpaces || running;
  const resultText = useMemo(() => (run.result ? JSON.stringify(run.result.data, null, 2) : ""), [run.result]);

  const change = (update: Partial<RunSettings>) => onChangeSettings({ ...settings, ...update });

  const execute = (page: number, markers: (string | undefined)[]) => {
    if (blocked) {
      return;
    }
    setRunning(true);
    getAccessToken()
      .then((token) =>
        runQuery(token, specification, {
          stage: settings.stage,
          size,
          marker: markers[page - 1],
          instanceId: instanceId || undefined,
          restrictToSpaces: settings.restrictToSpaces,
          filterValues: Object.fromEntries(parameterNames.map((name) => [name, settings.filterValues[name] ?? ""])),
        }),
      )
      .then((result) => onChangeRun({ result, page, markers }))
      .catch((e: unknown) => onChangeRun({ ...run, error: e instanceof Error ? e.message : String(e) }))
      .finally(() => setRunning(false));
  };

  const toggleSpace = (identifier: string, selected: boolean) => {
    const current = settings.restrictToSpaces ?? [];
    change({ restrictToSpaces: selected ? [...current, identifier] : current.filter((s) => s !== identifier) });
  };

  const result = run.result;
  const from = result ? (run.page - 1) * size + 1 : 0;

  return (
    <div className="query-run">
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          execute(1, [undefined]);
        }}
      >
        <div className="query-run-form">
          <Form.Group className="query-option" controlId="query-run-stage">
            <Form.Label>Stage</Form.Label>
            <Form.Select
              size="sm"
              value={settings.stage}
              onChange={(e) => change({ stage: e.target.value as QueryStage })}
            >
              <option value="RELEASED">Released</option>
              <option value="IN_PROGRESS">In progress</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="query-option" controlId="query-run-size">
            <Form.Label>Page size</Form.Label>
            <Form.Control
              size="sm"
              type="number"
              min={1}
              value={settings.size}
              isInvalid={invalidSize}
              onChange={(e) => change({ size: e.target.value })}
            />
          </Form.Group>
          <Form.Group className="query-option" controlId="query-run-instance">
            <Form.Label>Instance id</Form.Label>
            <Form.Control
              size="sm"
              value={settings.instanceId}
              placeholder="All instances"
              isInvalid={invalidInstanceId}
              onChange={(e) => change({ instanceId: e.target.value })}
            />
          </Form.Group>
          {parameterNames.map((name) => (
            <Form.Group key={name} className="query-option" controlId={`query-run-parameter-${name}`}>
              <Form.Label>{name}</Form.Label>
              <Form.Control
                size="sm"
                value={settings.filterValues[name] ?? ""}
                placeholder="Default of the filter"
                onChange={(e) => change({ filterValues: { ...settings.filterValues, [name]: e.target.value } })}
              />
            </Form.Group>
          ))}
        </div>
        {invalidInstanceId && <div className="query-option-warning">The instance id needs to be a UUID.</div>}

        {spaces.length > 0 && (
          <div className="query-option mt-3">
            <Form.Check
              id="query-run-restrict-spaces"
              type="checkbox"
              label="Restrict to space(s)"
              checked={settings.restrictToSpaces !== undefined}
              onChange={(e) => change({ restrictToSpaces: e.target.checked ? [] : undefined })}
            />
            {settings.restrictToSpaces !== undefined && (
              <div className="query-run-spaces">
                {spaces.map((space) => (
                  <Form.Check
                    key={space.identifier}
                    id={`query-run-space-${space.identifier}`}
                    type="checkbox"
                    label={spaceLabel(space)}
                    checked={settings.restrictToSpaces?.includes(space.identifier) ?? false}
                    onChange={(e) => toggleSpace(space.identifier, e.target.checked)}
                  />
                ))}
              </div>
            )}
            {noSpaces && <div className="query-option-warning">Select at least one space.</div>}
          </div>
        )}

        <div className="query-run-bar">
          <span className="query-run-summary" role="status">
            {running
              ? "Running..."
              : result
                ? `${result.data.length ? `${from}–${from + result.data.length - 1}` : "No results"}${
                    result.total !== undefined && result.total !== null ? ` of ${result.total}` : ""
                  }${result.durationInMs !== undefined && result.durationInMs !== null ? ` · took ${(result.durationInMs / 1000).toFixed(2)} s` : ""}`
                : isEmpty
                  ? "Add at least one field to run the query."
                  : ""}
          </span>
          {result && (
            <>
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={running || run.page <= 1}
                onClick={() => execute(run.page - 1, run.markers)}
              >
                Previous page
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={running || !result.nextMarker}
                onClick={() => execute(run.page + 1, [...run.markers.slice(0, run.page), result.nextMarker])}
              >
                Next page
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={() => download(result)}>
                Download
              </Button>
            </>
          )}
          <Button type="submit" variant="dark" size="sm" disabled={blocked}>
            {running && <Spinner animation="border" size="sm" role="status" className="me-2" />}
            Run query
          </Button>
        </div>
      </Form>

      {run.error && (
        <Alert variant="danger" dismissible onClose={() => onChangeRun({ ...run, error: undefined })}>
          {run.error}
        </Alert>
      )}
      {result && (
        <CodeMirror
          className="json-field json-field--readonly"
          value={resultText}
          maxHeight="65vh"
          extensions={jsonExtensions}
          basicSetup={jsonEditorSetup}
          editable={false}
          aria-label="Result of the query"
        />
      )}
    </div>
  );
}
