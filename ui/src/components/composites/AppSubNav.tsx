// src/components/AppSubNav.tsx
import React from "react";
import { Button, Col, Container, Row } from "react-bootstrap";

type CtaButton = {
  label: string;
  href: string;
  /** optional React element (e.g. <img/> or <svg/>) */
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "outline-primary" | "outline-secondary";
  size?: "sm" | "md" | "lg";
};

type AppSubNavProps = {
  title?: React.ReactNode;
  ctas: CtaButton[];
};

export default function AppSubNav({ title, ctas }: AppSubNavProps) {
  return (
    <Container fluid className="py-4">
      <Row className="align-items-center">
        {/* Left side – optional title / breadcrumb */}
        <Col xs={12} md={6}>
          {title && <h5 className="mb-0">{title}</h5>}
        </Col>

        {/* Right side – CTA buttons */}
        <Col
          xs={12}
          md={6}
          className="d-flex justify-content-md-end justify-content-start mt-2 mt-md-0"
        >
          {ctas.map((cta, i) => (
            <Button
              key={i}
              href={cta.href}
              variant={cta.variant ?? "outline-secondary"}
              size={cta.size ?? "sm"}
              className="ms-2"
            >
              {cta.icon && (
                <span className="me-1 d-inline-flex align-items-center">
                  {cta.icon}
                </span>
              )}
              {cta.label}
            </Button>
          ))}
        </Col>
      </Row>
    </Container>
  );
}
