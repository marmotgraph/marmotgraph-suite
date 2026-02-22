import React, { useState } from "react";
import { Button, Dropdown, Form, Nav } from "react-bootstrap";
import { NavLink, useNavigate } from "react-router-dom";
import marmotGraphLogo from "../assets/marmotgraph_dark.svg";
import marmotGraphIcon from "../assets/marmotgraph_dark_icon.svg";
import "./SidebarMG.css";

interface SidebarMGProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

function SidebarMG({ isCollapsed, onToggle }: SidebarMGProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/queries?search=${encodeURIComponent(searchQuery)}`);
    }
  };

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

      {/* Search Bar */}
      {!isCollapsed && (
        <div className="px-3 mb-1">
          <Form onSubmit={handleSearch}>
            <div className="sidebar-search-container">
              <ion-icon
                name="search-outline"
                className="sidebar-search-icon"
              ></ion-icon>
              <Form.Control
                type="search"
                placeholder="Search ⌘K"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sidebar-search-input"
              />
            </div>
          </Form>
        </div>
      )}

      {isCollapsed && (
        <div className="px-2 d-flex justify-content-center">
          <Button
            variant="link"
            className="p-2 text-dark sidebar-search-button"
            onClick={() => navigate("/queries")}
          >
            <ion-icon name="search-outline"></ion-icon>
          </Button>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-column flex-grow-1 px-2 d-flex">
        <NavLink
          to="/editor"
          className={({ isActive }) =>
            `d-flex align-items-center py-2 px-3 mb-1 text-dark rounded sidebar-nav-link ${isActive ? "active" : ""}`
          }
        >
          <ion-icon name="create-outline"></ion-icon>
          {!isCollapsed && <span className="ms-2">Editor</span>}
        </NavLink>
        <NavLink
          to="/queries"
          className={({ isActive }) =>
            `d-flex align-items-center py-2 px-3 mb-1 text-dark rounded sidebar-nav-link ${isActive ? "active" : ""}`
          }
        >
          <ion-icon name="construct-outline"></ion-icon>
          {!isCollapsed && <span className="ms-2">Query Builder</span>}
        </NavLink>
        <NavLink
          to="/visualizer"
          className={({ isActive }) =>
            `d-flex align-items-center py-2 px-3 mb-1 text-dark rounded sidebar-nav-link ${isActive ? "active" : ""}`
          }
        >
          <ion-icon name="bar-chart-outline"></ion-icon>
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
          <ion-icon name="book-outline"></ion-icon>
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
            variant="outline-light"
            className="sidebar-collapse-button"
            onClick={onToggle}
          >
            <ion-icon
              name={
                isCollapsed ? "chevron-forward-outline" : "chevron-back-outline"
              }
              size="large"
            ></ion-icon>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SidebarMG;
