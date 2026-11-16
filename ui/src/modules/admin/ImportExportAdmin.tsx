import React, { useMemo, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { CircleAlert, CircleCheck, Download, Upload } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTools } from "../../contexts/ToolsContext";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";
import { spaceManagementAvailable, useManagedSpaces } from "../../hooks/useManagedSpaces";
import {
  exportSettings,
  importSettings,
  ImportResult,
  parseSettings,
  SETTINGS_SECTION_LABELS,
  SETTINGS_SECTIONS,
  SettingsDocument,
  SettingsSection,
  settingsCount,
  settingsFileName,
} from "../../services/settings";
import { canManagePermissions } from "./RoleClaims";

/** The sections the user has the permissions for - the others can neither be exported nor imported. */
export function permittedSections(functionalities: string[] | undefined, managesSpaces: boolean): SettingsSection[] {
  const permitted: Record<SettingsSection, boolean> = {
    spaces: managesSpaces,
    permissions: canManagePermissions(functionalities),
    tenants: !!functionalities?.includes("TENANT_MANAGEMENT"),
    tools: !!functionalities?.includes("DEFINE_TOOLS"),
  };
  return SETTINGS_SECTIONS.filter((section) => permitted[section]);
}

function toggle(sections: SettingsSection[], section: SettingsSection, checked: boolean): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((s) => (s === section ? checked : sections.includes(s)));
}

/**
 * Exports the settings of the admin sections (the specifications of the spaces without their types, the permissions,
 * the tenants and the tools) into a JSON file - and imports such a file again, e.g. to restore the setup after the
 * database has been wiped. An import creates or updates the settings but never removes any.
 */
export default function ImportExportAdmin() {
  const functionalities = useGlobalFunctionalities();
  const { spaces } = useManagedSpaces();
  const permitted = useMemo(
    () => permittedSections(functionalities, spaceManagementAvailable(spaces, functionalities)),
    [functionalities, spaces],
  );

  if (!functionalities || !spaces) {
    return (
      <div className="admin-loading">
        <Spinner animation="border" size="sm" /> Loading permissions...
      </div>
    );
  }

  return (
    <div>
      <ExportCard permitted={permitted} />
      <ImportCard permitted={permitted} />
    </div>
  );
}

function ExportCard({ permitted }: Readonly<{ permitted: SettingsSection[] }>) {
  const { getAccessToken } = useAuth();
  const [selected, setSelected] = useState<SettingsSection[]>(permitted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const download = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const document = await exportSettings(await getAccessToken(), selected);
      const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }));
      const link = window.document.createElement("a");
      link.href = url;
      link.download = settingsFileName();
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-space-card" aria-labelledby="settings-export-title">
      <div className="admin-space-header admin-transfer-header">
        <span id="settings-export-title">Export</span>
      </div>
      <div className="admin-space-body admin-transfer-body">
        <p className="admin-transfer-hint">
          Downloads the selected settings as a JSON file. Spaces are exported with their settings but without the types assigned
          to them. Tenants include their theme and images.
        </p>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
            {error}
          </Alert>
        )}
        <fieldset className="mb-3">
          <legend className="admin-kicker">Sections</legend>
          {permitted.map((section) => (
            <Form.Check
              key={section}
              id={`export-${section}`}
              label={SETTINGS_SECTION_LABELS[section]}
              checked={selected.includes(section)}
              disabled={busy}
              onChange={(e) => setSelected((s) => toggle(s, section, e.target.checked))}
            />
          ))}
        </fieldset>
        <Button variant="outline-dark" size="sm" disabled={busy || selected.length === 0} onClick={download}>
          {busy ? <Spinner animation="border" size="sm" /> : <Download size={14} aria-hidden />} Export settings
        </Button>
      </div>
    </section>
  );
}

function ImportCard({ permitted }: Readonly<{ permitted: SettingsSection[] }>) {
  const { getAccessToken } = useAuth();
  const { reload: reloadTools } = useTools();
  const [document, setDocument] = useState<SettingsDocument>();
  const [fileError, setFileError] = useState<string>();
  const [selected, setSelected] = useState<SettingsSection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [results, setResults] = useState<ImportResult[]>();

  /** The sections contained in the file - with the number of settings in them. */
  const contained = useMemo(
    () =>
      document
        ? SETTINGS_SECTIONS.map((section) => ({ section, count: settingsCount(document, section) })).filter(
            (s): s is { section: SettingsSection; count: number } => s.count !== undefined,
          )
        : [],
    [document],
  );

  const choose = async (file: File | undefined) => {
    setDocument(undefined);
    setFileError(undefined);
    setResults(undefined);
    setError(undefined);
    if (!file) {
      return;
    }
    try {
      const parsed = parseSettings(await file.text());
      setDocument(parsed);
      setSelected(SETTINGS_SECTIONS.filter((s) => permitted.includes(s) && settingsCount(parsed, s) !== undefined));
    } catch (e) {
      setFileError((e as Error).message);
    }
  };

  const runImport = async () => {
    if (!document) {
      return;
    }
    setBusy(true);
    setError(undefined);
    setResults(undefined);
    try {
      setResults(await importSettings(await getAccessToken(), document, selected));
      if (selected.includes("tools")) {
        reloadTools();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-space-card" aria-labelledby="settings-import-title">
      <div className="admin-space-header admin-transfer-header">
        <span id="settings-import-title">Import</span>
      </div>
      <div className="admin-space-body admin-transfer-body">
        <p className="admin-transfer-hint">
          Restores the settings of an exported file. Settings with the same name are replaced - nothing else is removed, and claims
          are added to the ones a role already has.
        </p>
        <Form.Group className="mb-3" controlId="settings-import-file">
          <Form.Label>Settings file</Form.Label>
          <Form.Control
            type="file"
            size="sm"
            accept=".json,application/json"
            disabled={busy}
            isInvalid={!!fileError}
            onChange={(e) => choose((e.target as HTMLInputElement).files?.[0])}
          />
          <Form.Control.Feedback type="invalid">{fileError}</Form.Control.Feedback>
        </Form.Group>

        {document && (
          <>
            {document.exportedAt && (
              <p className="admin-transfer-hint">Exported on {new Date(document.exportedAt).toLocaleString()}</p>
            )}
            {contained.length === 0 ? (
              <p className="admin-space-empty">The file doesn't contain any settings.</p>
            ) : (
              <fieldset className="mb-3">
                <legend className="admin-kicker">Sections</legend>
                {contained.map(({ section, count }) => {
                  const allowed = permitted.includes(section);
                  return (
                    <Form.Check
                      key={section}
                      id={`import-${section}`}
                      label={
                        <>
                          {SETTINGS_SECTION_LABELS[section]} <span className="admin-result-count">{count}</span>
                          {!allowed && <span className="admin-space-unspecified"> - you don't have the permissions</span>}
                        </>
                      }
                      checked={selected.includes(section)}
                      disabled={busy || !allowed}
                      onChange={(e) => setSelected((s) => toggle(s, section, e.target.checked))}
                    />
                  );
                })}
              </fieldset>
            )}
            {error && (
              <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
                {error}
              </Alert>
            )}
            <Button variant="outline-dark" size="sm" disabled={busy || selected.length === 0} onClick={runImport}>
              {busy ? <Spinner animation="border" size="sm" /> : <Upload size={14} aria-hidden />} Import settings
            </Button>
          </>
        )}

        {results && <ImportResults results={results} />}
      </div>
    </section>
  );
}

function ImportResults({ results }: Readonly<{ results: ImportResult[] }>) {
  const failed = results.filter((r) => r.error).length;
  return (
    <div className="admin-transfer-results" aria-live="polite">
      <div className="d-flex align-items-center mb-1">
        <span className="admin-kicker">Result</span>
        <span className="admin-result-count ms-auto">
          {results.length - failed} imported{failed > 0 && `, ${failed} failed`}
        </span>
      </div>
      {results.length === 0 ? (
        <p className="admin-space-empty">There was nothing to import.</p>
      ) : (
        <ul className="admin-transfer-result-list">
          {results.map((result, i) => (
            <li key={`${result.section}-${i}`} className={result.error ? "admin-transfer-failed" : "admin-transfer-imported"}>
              {result.error ? <CircleAlert size={14} aria-label="Failed" /> : <CircleCheck size={14} aria-label="Imported" />}
              <span className="admin-transfer-section">{SETTINGS_SECTION_LABELS[result.section]}</span>
              <span className="admin-space-name">{result.item || "(unnamed)"}</span>
              {result.error && <span className="admin-transfer-error">{result.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
