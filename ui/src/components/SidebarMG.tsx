import React from "react";
import { Button, Dropdown, Nav } from "react-bootstrap";
import { NavLink, useNavigate } from "react-router-dom";
// @ts-ignore
import marmotGraphLogo from "../assets/marmotgraph_dark.svg";
// @ts-ignore
import marmotGraphIcon from "../assets/marmotgraph_dark_icon.svg";

import "./SidebarMG.css";
import {
  Blocks,
  BookmarkCheck,
  ChartScatter,
  Edit3Icon,
  PanelLeftClose,
  PanelRightOpenIcon,
} from "lucide-react";

interface SidebarMGProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

function SidebarMG({ isCollapsed, onToggle }: SidebarMGProps) {
  const navigate = useNavigate();

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
            src={marmotGraphLogo}
            alt="MarmotGraph"
            className="sidebar-logo-full"
          />
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-column flex-grow-1 px-2 d-flex">
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
      </div>

      {/* Bottom Section */}
      <div className="mt-auto pt-3 sidebar-bottom">
        {/* Documentation Link */}
        <Nav.Link
          href="https://docs.marmotgraph.com"
          target="_blank"
          className="d-flex align-items-center py-2 px-3 mb-2 text-dark rounded mx-2 sidebar-nav-link"
        >
          <BookmarkCheck size={18} />
          {!isCollapsed && <span className="ms-2">Documentation</span>}
        </Nav.Link>

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
                  A
                </div>
                {!isCollapsed && (
                  <span className="ms-2 text-dark fw-medium">User</span>
                )}
              </div>
            </Dropdown.Toggle>

            <Dropdown.Menu>
              <Dropdown.Item href="#/profile">Profile</Dropdown.Item>
              <Dropdown.Item href="#/settings">Settings</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item href="#/logout">Logout</Dropdown.Item>
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
