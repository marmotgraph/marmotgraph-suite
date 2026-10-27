// src/components/composites/AppSubNav.tsx
import React, { useState } from "react";
import { Button, Col, Container, Modal, Row } from "react-bootstrap";
import { useRegisteredSubNavActions } from "../../contexts/SubNavActionsContext";

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
    body:
      | React.ReactNode
      | ((onTypeSelect: (typeIdentifier: string) => void) => React.ReactNode);
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
  // The page actions of the current view (e.g. only available with the permissions to use them)
  const actions = useRegisteredSubNavActions();

  const handleModalClick = (index: number) => {
    setOpenModalIndex(index);
    setSelectedType(null); // Reset selection when opening
  };

  const handleCloseModal = () => {
    setOpenModalIndex(null);
    setSelectedType(null);
  };

  const handleTypeSelection = (typeIdentifier: string) => {
    setSelectedType(typeIdentifier);
  };

  const handleCreate = () => {
    // The id of the new instance is generated on the client - it is marked as new since it is not known to the core yet
    const instanceId = crypto.randomUUID();
    // Navigate to the instance form with the type as query param - the name is given by the label field of the type
    window.location.href = `/editor/instances/${instanceId}?new=1&type=${encodeURIComponent(selectedType || '')}`;
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
          {actions.map((action) => (
            <Button key={action.label} variant="dark" size="sm" className="ms-2" onClick={action.onClick}>
              {action.icon && <span className="me-1 d-inline-flex align-items-center">{action.icon}</span>}
              {action.label}
            </Button>
          ))}
        </Col>
      </Row>

      {ctas.map((cta, i) => {
        if (!cta.modal) return null;

        // Check if body is a function (render prop pattern)
        const modalBody =
          typeof cta.modal.body === "function"
            ? cta.modal.body(handleTypeSelection)
            : cta.modal.body;

        // Determine if Create button should be enabled
        const isCreateEnabled = Boolean(selectedType);

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
