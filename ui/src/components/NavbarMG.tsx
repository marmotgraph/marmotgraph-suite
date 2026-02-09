import React from "react";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import Button from "react-bootstrap/Button";

import enrichIcon from "../assets/icons/enrich_light.svg";
import queryIcon from "../assets/icons/query-builder_light.svg";
import visualizeIcon from "../assets/icons/visualizer_light.svg";
import logo from "../assets/marmotgraph_light.svg";

function NavbarMG() {
  return (
    <Navbar fixed="top" expand="lg" className="bg-body-tertiary">
      <Container>
        <Navbar.Brand href="/">
          <img
            alt=""
            src={logo}
            width="200"
            height="50"
            className="d-inline-block align-top"
          />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto align-items-start">
            <Nav.Link href="#home">Documentation</Nav.Link>
            <Nav.Link href="#link">Git</Nav.Link>
          </Nav>
          <Nav className="align-items-start">
            {/* ---- EDITOR BUTTON ---- */}
            <Nav.Link href="editor" className="p-0">
              <Button
                variant="outline-secondary"
                size="sm"
                className="me-2 d-inline-flex align-items-start"
              >
                <img
                  src={enrichIcon}
                  width={20}
                  height={20}
                  className="me-1"
                  alt="Editor"
                />
                Editor
              </Button>
            </Nav.Link>

            {/* ---- QUERY BUILDER BUTTON ---- */}
            <Nav.Link href="queries" className="p-0">
              <Button
                variant="outline-secondary"
                size="sm"
                className="me-2 d-inline-flex align-items-start"
              >
                <img
                  src={queryIcon}
                  width={20}
                  height={20}
                  className="me-1"
                  alt="Query Builder"
                />
                Query Builder
              </Button>
            </Nav.Link>

            {/* ---- VISUALIZER BUTTON ---- */}
            <Nav.Link href="visualizer" className="p-0">
              <Button
                variant="outline-secondary"
                size="sm"
                className="me-2 d-inline-flex align-items-center"
              >
                <img
                  src={visualizeIcon}
                  width={20}
                  height={20}
                  className="me-1"
                  alt="Visualizer"
                />
                Visualizer
              </Button>
            </Nav.Link>
            <Nav.Link href="#deets">User</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavbarMG;
