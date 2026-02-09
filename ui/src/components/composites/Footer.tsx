import React from "react";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import PoweredBy from "../../views/PoweredBy";

// Optional: you can pull in any icons or links you want here
export default function Footer() {
  return (
    <footer className="mt-auto">
      <Row className="align-items-center">
        <Col md={6} className="text-center text-md-start">
          {/* Replace with your own copyright text */}©{" "}
          {new Date().getFullYear()} MarmotGraph – All rights reserved
        </Col>

        <Col md={6} className="text-center text-md-end">
          <PoweredBy />
        </Col>
      </Row>
    </footer>
  );
}
