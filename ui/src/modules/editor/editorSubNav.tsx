// src/modules/editor/editorSubNav.tsx
import React from "react";
import TypeListFilter from "../../components/TypeListFilter";

export const editorSubNav = {
  title: "Editor",
  ctas: [
    {
      label: "Create new instance",
      href: "/editor/new",
      variant: "dark" as const,
      size: "sm" as const,
      modal: {
        show: false,
        title: "Create New Instance",
        body: (onTypeSelect: (typeIdentifier: string) => void) => (
          <div>
            <div className="alert alert-info py-2 px-3 mb-3" style={{ fontSize: '0.85rem' }}>
              <strong>Note:</strong> The instance will be saved to your private space (<strong style={{ color: '#0056b3' }}>private-xxxxx</strong>) by default.
              You can change the space later when saving the instance.
            </div>
            <div className="mb-3">
              <label htmlFor="type-filter" className="form-label fw-bold">
                Select type <span className="text-danger fw-bold">*</span>
              </label>
            </div>
            <TypeListFilter onTypeSelect={onTypeSelect} />
          </div>
        ),
      },
    },
  ],
};
