import React, { useState } from "react";
import { Alert, Col, Form, Row, Spinner, Tab, Tabs } from "react-bootstrap";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";
import { MANAGE_SPACE, spaceManagementAvailable, useManagedSpaces } from "../../hooks/useManagedSpaces";
import { useSubNavActions } from "../../contexts/SubNavActionsContext";
import { ManagedSpace } from "../../services/spaces";
import { canManagePermissions } from "../admin/RoleClaims";
import { AddSpaceModal } from "./SpaceModals";
import SpaceSettingsTab from "./SpaceSettingsTab";
import SpaceTypes from "./SpaceTypes";
import SpacePermissions from "./SpacePermissions";
import "../admin/Admin.css";

/** The list of spaces gets a filter from this number of spaces on. */
const FILTER_THRESHOLD = 10;

/**
 * Manages the spaces the user is allowed to manage - each space with its settings, the types assigned to it and (with
 * the global permissions to manage permissions) the claims of its roles. The selected space is part of the path
 * (absolute paths - see AdminHome).
 */
export default function SpacesHome() {
  const functionalities = useGlobalFunctionalities();
  const { spaces, error, reload } = useManagedSpaces();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const canAdd = !!functionalities?.includes(MANAGE_SPACE);

  useSubNavActions(canAdd ? [{ label: "Add space", icon: <Plus size={16} />, onClick: () => setAdding(true) }] : []);

  if (!spaces || !functionalities) {
    return (
      <div className="admin-loading">
        <Spinner animation="border" size="sm" /> Loading spaces...
      </div>
    );
  }

  if (!spaceManagementAvailable(spaces, functionalities)) {
    return error ? <Alert variant="danger">{error}</Alert> : <p className="admin-empty">You don't manage any spaces.</p>;
  }

  const added = (space: string) => {
    setAdding(false);
    reload();
    navigate(`/spaces/${encodeURIComponent(space)}`);
  };

  return (
    <div className="admin-home">
      {error && <Alert variant="danger">{error}</Alert>}
      <Routes>
        <Route
          path=":space"
          element={<SpaceView spaces={spaces} canManagePermissions={canManagePermissions(functionalities)} reload={reload} />}
        />
        <Route
          path="*"
          element={
            spaces.length ? (
              <Navigate to={`/spaces/${encodeURIComponent(spaces[0].identifier)}`} replace />
            ) : (
              <SpaceView spaces={spaces} canManagePermissions={false} reload={reload} />
            )
          }
        />
      </Routes>
      {adding && (
        <AddSpaceModal existing={spaces.map((s) => s.identifier)} onHide={() => setAdding(false)} onAdded={added} />
      )}
    </div>
  );
}

/** The list of the spaces next to the selected one. */
function SpaceView({ spaces, canManagePermissions, reload }: {
  spaces: ManagedSpace[];
  canManagePermissions: boolean;
  reload: () => void;
}) {
  const { space: selected } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("settings");
  const space = spaces.find((s) => s.identifier === selected);

  const needle = filter.trim().toLowerCase();
  const visible = spaces.filter(
    (s) => !needle || s.identifier.toLowerCase().includes(needle) || s.name?.toLowerCase().includes(needle),
  );

  /** The specification is gone - so is the space if there were no types in it. */
  const deleted = () => {
    reload();
    navigate("/spaces");
  };

  return (
    <Row>
      <Col md={3} className="mb-3">
        <div className="d-flex align-items-center mb-2">
          <span className="admin-kicker">Spaces</span>
          <span className="admin-result-count ms-auto">
            {needle ? `${visible.length} of ${spaces.length}` : spaces.length}
          </span>
        </div>
        {spaces.length > FILTER_THRESHOLD && (
          <Form.Control
            size="sm"
            type="search"
            className="mb-2"
            placeholder="Filter spaces..."
            aria-label="Filter spaces"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
        {spaces.length === 0 && <p className="admin-empty">You don't manage any spaces yet.</p>}
        {spaces.length > 0 && visible.length === 0 && <p className="admin-empty">No spaces match the filter.</p>}
        {visible.length > 0 && (
          <nav className="admin-list" aria-label="Spaces">
            {visible.map((s) => (
              <button
                type="button"
                key={s.identifier}
                aria-current={s.identifier === selected ? "true" : undefined}
                className={`admin-list-item${s.identifier === selected ? " admin-list-item--selected" : ""}`}
                onClick={() => navigate(`/spaces/${encodeURIComponent(s.identifier)}`)}
              >
                {s.identifier}
              </button>
            ))}
          </nav>
        )}
      </Col>
      <Col md={9}>
        {selected && !space && <p className="admin-empty">You don't manage the space "{selected}".</p>}
        {space && (
          <div className="instance-focus-panel admin-details">
            <div className="instance-header">
              <div className="instance-type-label">Space</div>
              <h2 className="instance-name">{space.name || space.identifier}</h2>
              {space.name && space.name !== space.identifier && (
                <div className="admin-identifier">{space.identifier}</div>
              )}
            </div>
            <Tabs activeKey={tab} onSelect={(key) => setTab(key ?? "settings")} className="mb-3" mountOnEnter>
              <Tab eventKey="settings" title="Settings">
                <SpaceSettingsTab key={space.identifier} space={space.identifier} onDeleted={deleted} />
              </Tab>
              <Tab eventKey="types" title="Types">
                <SpaceTypes key={space.identifier} space={space.identifier} />
              </Tab>
              {canManagePermissions && (
                <Tab eventKey="permissions" title="Permissions">
                  <SpacePermissions space={space.identifier} />
                </Tab>
              )}
            </Tabs>
          </div>
        )}
      </Col>
    </Row>
  );
}
