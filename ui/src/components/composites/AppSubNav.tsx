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
      | ((
          onTypeSelect: (typeName: string) => void,
          onInstanceNameChange?: (name: string) => void,
          instanceName?: string
        ) => React.ReactNode);
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
  const [instanceName, setInstanceName] = useState<string>("");

  const handleModalClick = (index: number) => {
    setOpenModalIndex(index);
    setSelectedType(null); // Reset selection when opening
    setInstanceName(""); // Reset instance name when opening
  };

  const handleCloseModal = () => {
    setOpenModalIndex(null);
    setSelectedType(null);
    setInstanceName("");
  };

  const handleTypeSelection = (typeName: string) => {
    setSelectedType(typeName);
  };

  const handleInstanceNameChange = (name: string) => {
    setInstanceName(name);
  };

  const handleCreate = () => {
    // Generate a temporary ID for the new instance
    const tempId = `new-${Date.now()}`;
    // Navigate to the instance form with the name and type as query params
    window.location.href = `/editor/instance/${tempId}?name=${encodeURIComponent(instanceName)}&type=${encodeURIComponent(selectedType || '')}`;
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
            ? cta.modal.body(handleTypeSelection, handleInstanceNameChange, instanceName)
            : cta.modal.body;

        // Determine if Create button should be enabled
        const isCreateEnabled = selectedType && instanceName.trim().length > 0;

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
              <Button variant="outline-secondary" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button
                variant="dark"
                onClick={handleCreate}
                disabled={!isCreateEnabled}
              >
                Create
              </Button>
            </Modal.Footer>
          </Modal>
        );
      })}
    </Container>
  );
}
