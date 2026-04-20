// src/components/composites/AppSubNav.tsx
import React, { useState } from "react";
import { Button, Col, Container, Modal, Row } from "react-bootstrap";

type CtaButton = {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  variant?:
    | "primary"
    | "secondary"
    | "outline-primary"
    | "outline-secondary"
    | "dark"
    | "outline-dark";
  size?: "sm" | "lg";
  modal?: {
    show: boolean;
    title: string;
    // ← Change body to accept a function OR ReactNode
    body:
      | React.ReactNode
      | ((onTypeSelect: (typeName: string) => void) => React.ReactNode);
    onClose: () => void;
  };
};

type AppSubNavProps = {
  title?: React.ReactNode;
  ctas: CtaButton[];
};

export default function AppSubNav({ title, ctas }: AppSubNavProps) {
  const [openModalIndex, setOpenModalIndex] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleModalClick = (index: number) => {
    setOpenModalIndex(index);
    setSelectedType(null); // Reset selection when opening
  };

  const handleCloseModal = () => {
    setOpenModalIndex(null);
    setSelectedType(null);
  };

  const handleTypeSelection = (typeName: string) => {
    setSelectedType(typeName);
  };

  return (
    <Container fluid className="py-4">
      <Row className="align-items-center">
        <Col xs={12} md={6}>
          {title && <h5 className="mb-0">{title}</h5>}
        </Col>

        <Col
          xs={12}
          md={6}
          className="d-flex justify-content-md-end justify-content-start mt-2 mt-md-0"
        >
          {ctas.map((cta, i) => {
            const hasModal = !!cta.modal;
            return (
              <Button
                key={i}
                href={hasModal ? undefined : cta.href}
                variant={cta.variant ?? "outline-secondary"}
                size={cta.size ?? "sm"}
                className="ms-2"
                onClick={(e) => {
                  if (hasModal) {
                    e.preventDefault();
                    handleModalClick(i);
                  }
                }}
              >
                {cta.icon && (
                  <span className="me-1 d-inline-flex align-items-center">
                    {cta.icon}
                  </span>
                )}
                {cta.label}
              </Button>
            );
          })}
        </Col>
      </Row>

      {ctas.map((cta, i) => {
        if (!cta.modal) return null;

        // Check if body is a function (render prop pattern)
        const modalBody =
          typeof cta.modal.body === "function"
            ? cta.modal.body(handleTypeSelection)
            : cta.modal.body;

        return (
          <Modal
            key={`modal-${i}`}
            show={openModalIndex === i}
            onHide={handleCloseModal}
            centered
          >
            <Modal.Header closeButton>
              <Modal.Title>{cta.modal.title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>{modalBody}</Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCloseModal}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={handleCloseModal}
                disabled={!selectedType}
              >
                Save Changes
              </Button>
            </Modal.Footer>
          </Modal>
        );
      })}
    </Container>
  );
}
