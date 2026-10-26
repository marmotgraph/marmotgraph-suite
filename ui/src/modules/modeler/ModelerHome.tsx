import React, { useCallback, useEffect, useState } from "react";
import { Alert, Nav, Spinner } from "react-bootstrap";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { List, Network } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";
import {
  DEFINE_TYPES,
  DEFINE_VALIDATION_SCHEMAS,
  fetchModel,
  fetchSpecificationStatus,
  modelerAvailable,
  ModelType,
  SpecificationStatus,
} from "../../services/modeler";
import TypeList from "./TypeList";
import TypeGraph from "./TypeGraph";
import "./Modeler.css";

/** What the views of the modeler share - the model and the rights of the user to modify it. */
export interface ModelerContext {
  types: ModelType[];
  /** Loads the model again (e.g. after it has been modified) */
  reload: () => Promise<void>;
  /** How far the types are specified (by their identifier) - undefined while they are checked */
  specificationStatus?: Record<string, SpecificationStatus>;
  canDefineTypes: boolean;
  canDefineSchemas: boolean;
}

/**
 * Manages the types of the graph and their relations - either as a list of the types (to edit them) or as a graph
 * showing the dependencies between the types. The selected type is kept in the "type" query parameter so it is
 * preserved when switching between the views. The paths are absolute (see AdminHome).
 */
export default function ModelerHome() {
  const { getAccessToken } = useAuth();
  const functionalities = useGlobalFunctionalities();
  const { search } = useLocation();
  const [types, setTypes] = useState<ModelType[]>();
  const [specificationStatus, setSpecificationStatus] = useState<Record<string, SpecificationStatus>>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    try {
      const token = await getAccessToken();
      // Checking the specifications takes longer (one request per type and property) - the model is shown in the meantime
      fetchSpecificationStatus(token)
        .then(setSpecificationStatus)
        .catch(() => setSpecificationStatus(undefined));
      setTypes(await fetchModel(token));
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [getAccessToken]);

  const available = modelerAvailable(functionalities);

  useEffect(() => {
    // The model is only loaded for admins
    if (available) {
      reload();
    }
  }, [reload, available]);

  if (!functionalities) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" /> Loading permissions...
      </div>
    );
  }

  if (!available) {
    return <p className="text-muted">The modeler is only available to administrators.</p>;
  }

  if (!types) {
    return error ? (
      <Alert variant="danger">{error}</Alert>
    ) : (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" /> Loading types...
      </div>
    );
  }

  const context: ModelerContext = {
    types,
    reload,
    specificationStatus,
    canDefineTypes: !!functionalities?.includes(DEFINE_TYPES),
    canDefineSchemas: !!functionalities?.includes(DEFINE_VALIDATION_SCHEMAS),
  };

  // The selected type is kept when switching between the views
  const selection = new URLSearchParams(search).get("type");
  const query = selection ? `?type=${encodeURIComponent(selection)}` : "";

  return (
    <div className="modeler-home">
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      <Nav variant="tabs" className="mb-3">
        <Nav.Item>
          <Nav.Link as={NavLink} to={`/modeler/types${query}`} className="d-flex align-items-center">
            <List size={16} className="me-2" />
            Types
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link as={NavLink} to={`/modeler/graph${query}`} className="d-flex align-items-center">
            <Network size={16} className="me-2" />
            Graph
          </Nav.Link>
        </Nav.Item>
      </Nav>
      <Routes>
        <Route path="types" element={<TypeList {...context} />} />
        <Route path="graph" element={<TypeGraph {...context} />} />
        <Route path="*" element={<Navigate to={`/modeler/types${query}`} replace />} />
      </Routes>
    </div>
  );
}
