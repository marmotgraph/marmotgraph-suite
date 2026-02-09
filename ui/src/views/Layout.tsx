// src/layout/Layout.tsx
import React, { useState } from "react";
import { Button, Nav, Offcanvas } from "react-bootstrap";

import NavbarMG from "../components/NavbarMG";
import Footer from "../components/composites/Footer";
import "./Layout.css";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [showSidebar, setShowSidebar] = useState(false);
  const handleClose = () => setShowSidebar(false);
  const handleShow = () => setShowSidebar(true);

  return (
    <>
      <NavbarMG />
      <div className="app-root d-flex flex-column min-vh-100 pt-5">
        <div className="content-inner flex-grow-1 d-flex">
          <div className="toggle-col me-2">
            <Button
              variant="outline-primary"
              className="sidebar-toggle-btn"
              onClick={handleShow}
              aria-label="Open navigation menu"
            >
              ☰
            </Button>
          </div>

          {showSidebar && (
            <Offcanvas
              show={showSidebar}
              onHide={handleClose}
              placement="start"
              backdrop={false}
              className="custom-sidebar"
              style={{ width: "260px" }}
            >
              <Offcanvas.Header closeButton>
                <Offcanvas.Title>Navigation</Offcanvas.Title>
              </Offcanvas.Header>

              <Offcanvas.Body>
                <Nav className="flex-column">
                  <Nav.Link href="#/dashboard">Dashboard</Nav.Link>
                  <Nav.Link href="#/queries">Query Builder</Nav.Link>
                  <Nav.Link href="#/visualizer">Visualizer</Nav.Link>
                </Nav>
              </Offcanvas.Body>
            </Offcanvas>
          )}

          <main className="flex-grow-1 main-col">{children}</main>
        </div>

        <Footer />
      </div>
    </>
  );
}
