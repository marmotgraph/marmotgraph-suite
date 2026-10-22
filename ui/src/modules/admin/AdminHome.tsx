import React from "react";
import { Nav, Spinner } from "react-bootstrap";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Building2, KeyRound } from "lucide-react";
import PermissionsAdmin from "./PermissionsAdmin";
import TenantsAdmin from "./TenantsAdmin";
import { AdminSection, adminSections } from "./adminSections";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";
import "./Admin.css";

const TABS: Record<AdminSection, { label: string; icon: React.ReactNode; element: React.ReactNode }> = {
  permissions: { label: "Permissions", icon: <KeyRound size={16} className="me-2" />, element: <PermissionsAdmin /> },
  tenants: { label: "Tenants", icon: <Building2 size={16} className="me-2" />, element: <TenantsAdmin /> },
};

/**
 * The administration of the core - each functionality is provided in its own tab which is only available if the user
 * has the required permissions. The paths are absolute since relative ones are resolved against the full url within
 * splat routes (e.g. "permissions" from /admin/tenants would lead to /admin/tenants/permissions - and the fallback
 * redirect would then loop forever).
 */
export default function AdminHome() {
  const functionalities = useGlobalFunctionalities();

  if (!functionalities) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" /> Loading permissions...
      </div>
    );
  }

  const sections = adminSections(functionalities);
  if (sections.length === 0) {
    return <p className="text-muted">You don't have the permissions to administrate MarmotGraph.</p>;
  }

  return (
    <div className="admin-home">
      <Nav variant="tabs" className="mb-3">
        {sections.map((section) => (
          <Nav.Item key={section}>
            <Nav.Link as={NavLink} to={`/admin/${section}`} className="d-flex align-items-center">
              {TABS[section].icon}
              {TABS[section].label}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
      <Routes>
        {sections.map((section) => (
          <Route key={section} path={section} element={TABS[section].element} />
        ))}
        <Route path="*" element={<Navigate to={`/admin/${sections[0]}`} replace />} />
      </Routes>
    </div>
  );
}
