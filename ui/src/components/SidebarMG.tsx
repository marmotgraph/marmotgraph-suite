import React, { useState } from "react";
import { Button, Dropdown } from "react-bootstrap";
import { NavLink, useNavigate } from "react-router-dom";
// @ts-ignore
import marmotGraphLogo from "../assets/marmotgraph_dark.svg";
// @ts-ignore
import marmotGraphIcon from "../assets/marmotgraph_dark_icon.svg";

import "./SidebarMG.css";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useAuth } from "../contexts/AuthContext";
import { useConfig } from "../contexts/ConfigContext";
import { imageUrl } from "../services/tenants";
import { userLabel } from "../services/users";
import { useGlobalFunctionalities } from "../hooks/useGlobalFunctionalities";
import { adminSections } from "../modules/admin/adminSections";
import { modelerAvailable } from "../services/modeler";
import { useTools } from "../contexts/ToolsContext";
import ToolCategoryIcon from "./ToolCategoryIcon";
import {
  Blocks,
  BookmarkCheck,
  ChartColumn,
  ChartScatter,
  CodeXml,
  Edit3Icon,
  Network,
  PanelLeftClose,
  PanelRightOpenIcon,
  ShieldCheck,
} from "lucide-react";

interface SidebarMGProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

function SidebarMG({ isCollapsed, onToggle }: SidebarMGProps) {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { logout } = useAuth();
  const userName = (user && userLabel(user)) || "User";
  // The admin module is only shown if at least one of its sections is available to the user
  const functionalities = useGlobalFunctionalities();
  const showAdmin = adminSections(functionalities).length > 0;
  const showModeler = modelerAvailable(functionalities);
  // The tools built on top of the graph - one entry per category with tools available to the user
  const toolCategories = useTools().categories ?? [];
  const { coreUrl, tenant } = useConfig();
  // The logo of the tenant (light mode) - the MarmotGraph logo is shown if the core can't provide it
  const [tenantLogoFailed, setTenantLogoFailed] = useState(false);
  const logo = tenantLogoFailed ? marmotGraphLogo : imageUrl(coreUrl, tenant, "logo", false);

  // @ts-ignore
  return (
    <div
      className={`sidebar-mg d-flex flex-column ${isCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}
    >
      {/* Logo Section */}
      <div className="p-3 sidebar-logo" onClick={() => navigate("/")}>
        {isCollapsed ? (
          <img
            src={marmotGraphIcon}
            alt="MarmotGraph"
            className="sidebar-logo-icon"
          />
        ) : (
          <img
            src={logo}
            alt={tenantLogoFailed ? "MarmotGraph" : tenant}
            className="sidebar-logo-full"
            onError={() => setTenantLogoFailed(true)}
          />
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-column flex-grow-1 px-2 d-flex sidebar-nav">
        <NavLink
          to="/editor"
          className={({ isActive }) =>
            `d-flex align-items-center py-2 px-3 mb-1 text-dark rounded sidebar-nav-link ${isActive ? "active" : ""}`
          }
        >
          <Edit3Icon size={18} />
          {!isCollapsed && <span className="ms-2">Editor</span>}
        </NavLink>
        <NavLink
          to="/queries"
          className={({ isActive }) =>
            `d-flex align-items-center py-2 px-3 mb-1 text-dark rounded sidebar-nav-link ${isActive ? "active" : ""}`
          }
        >
          <Blocks size={18} />
          {!isCollapsed && <span className="ms-2">Query Builder</span>}
        </NavLink>
        <NavLink
          to="/visualizer"
          className={({ isActive }) =>
            `d-flex align-items-center py-2 px-3 mb-1 text-dark rounded sidebar-nav-link ${isActive ? "active" : ""}`
          }
        >
          <ChartScatter size={18} />
          {!isCollapsed && <span className="ms-2">Visualizer</span>}
        </NavLink>
        {showModeler && (
          <NavLink
            to="/modeler"
            className={({ isActive }) =>
              `d-flex align-items-center py-2 px-3 mb-1 text-dark rounded sidebar-nav-link ${isActive ? "active" : ""}`
            }
          >
            <Network size={18} />
            {!isCollapsed && <span className="ms-2">Modeler</span>}
          </NavLink>
        )}
        <NavLink
          to="/statistics"
          className={({ isActive }) =>
            `d-flex align-items-center py-2 px-3 mb-1 text-dark rounded sidebar-nav-link ${isActive ? "active" : ""}`
          }
        >
          <ChartColumn size={18} />
          {!isCollapsed && <span className="ms-2">Statistics</span>}
        </NavLink>
        <NavLink
          to="/core-api"
          className={({ isActive }) =>
            `d-flex align-items-center py-2 px-3 mb-1 text-dark rounded sidebar-nav-link ${isActive ? "active" : ""}`
          }
        >
          <CodeXml size={18} />
          {!isCollapsed && <span className="ms-2">API</span>}
        </NavLink>
        {showAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `d-flex align-items-center py-2 px-3 mb-1 text-dark rounded sidebar-nav-link ${isActive ? "active" : ""}`
            }
          >
            <ShieldCheck size={18} />
            {!isCollapsed && <span className="ms-2">Admin</span>}
          </NavLink>
        )}

        {toolCategories.length > 0 && (
          <nav aria-label="Tools built on KG" className="sidebar-section">
            {isCollapsed ? (
              <hr className="sidebar-section-divider" aria-hidden="true" />
            ) : (
              <div className="sidebar-section-title px-3">Tools built on KG</div>
            )}
            {toolCategories.map((category) => (
              <NavLink
                key={category.id}
                to={`/tools/${category.id}`}
                title={isCollapsed ? category.name : undefined}
                aria-label={isCollapsed ? category.name : undefined}
                className={({ isActive }) =>
                  `d-flex align-items-center py-2 px-3 mb-1 text-dark rounded sidebar-nav-link ${isActive ? "active" : ""}`
                }
              >
                <span className="sidebar-tool-icon" aria-hidden="true">
                  <ToolCategoryIcon icon={category.icon} size={18} />
                </span>
                {!isCollapsed && <span className="ms-2 sidebar-nav-label">{category.name}</span>}
              </NavLink>
            ))}
          </nav>
        )}
      </div>

      {/* Bottom Section */}
      <div className="mt-auto pt-3 sidebar-bottom">
        {/* Documentation Link - the overview of the documentations, which open in a new tab */}
        <NavLink
          to="/documentation"
          className={({ isActive }) =>
            `d-flex align-items-center py-2 px-3 mb-2 text-dark rounded mx-2 sidebar-nav-link ${isActive ? "active" : ""}`
          }
        >
          <BookmarkCheck size={18} />
          {!isCollapsed && <span className="ms-2">Documentation</span>}
        </NavLink>

        {/* User Switcher and Collapse Button */}
        <div
          className={`sidebar-collapse-container ${isCollapsed ? "sidebar-collapse-container-collapsed" : "sidebar-collapse-container-expanded"}`}
        >
          <Dropdown drop="up">
            <Dropdown.Toggle as="div" className="sidebar-user-toggle">
              <div
                className="d-flex align-items-center"
                style={{ cursor: "pointer" }}
              >
                <div className="rounded-circle bg-dark text-white d-flex align-items-center justify-content-center sidebar-user-avatar">
                  {userName.charAt(0).toUpperCase()}
                </div>
                {!isCollapsed && (
                  <span className="ms-2 text-dark fw-medium">
                    {userName}
                  </span>
                )}
              </div>
            </Dropdown.Toggle>

            <Dropdown.Menu>
              <Dropdown.Item href="#/profile">Profile</Dropdown.Item>
              <Dropdown.Item href="#/settings">Settings</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item
                disabled={!logout}
                title={logout ? undefined : "Logging out is not supported by the identity provider"}
                onClick={() => logout?.()}
              >
                Logout
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          {/* Collapse Button */}
          <Button
            variant="filled-light"
            // className="sidebar-collapse-button"
            onClick={onToggle}
          >
            {isCollapsed ? <PanelRightOpenIcon /> : <PanelLeftClose />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SidebarMG;
