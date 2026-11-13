import React from "react";
import { Spinner } from "react-bootstrap";
import { Navigate, Route, Routes } from "react-router-dom";
import PermissionsAdmin from "./PermissionsAdmin";
import TenantsAdmin from "./TenantsAdmin";
import ToolsAdmin from "./ToolsAdmin";
import { AdminSection, adminSections } from "./adminSections";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";
import "./Admin.css";

const ELEMENTS: Record<AdminSection, React.ReactNode> = {
  permissions: <PermissionsAdmin />,
  tenants: <TenantsAdmin />,
  tools: <ToolsAdmin />,
};

/**
 * The administration of the core - each functionality is a section of its own in the navigation which is only
 * available if the user has the required permissions. The paths are absolute since relative ones are resolved against
 * the full url within splat routes (e.g. "permissions" from /admin/tenants would lead to /admin/tenants/permissions -
 * and the fallback redirect would then loop forever).
 */
export default function AdminHome() {
  const functionalities = useGlobalFunctionalities();

  if (!functionalities) {
    return (
      <div className="admin-loading">
        <Spinner animation="border" size="sm" /> Loading permissions...
      </div>
    );
  }

  const sections = adminSections(functionalities);
  if (sections.length === 0) {
    return <p className="admin-empty">You don't have the permissions to administrate MarmotGraph.</p>;
  }

  return (
    <div className="admin-home">
      <Routes>
        {sections.map((section) => (
          <Route key={section} path={section} element={ELEMENTS[section]} />
        ))}
        <Route path="*" element={<Navigate to={`/admin/${sections[0]}`} replace />} />
      </Routes>
    </div>
  );
}
