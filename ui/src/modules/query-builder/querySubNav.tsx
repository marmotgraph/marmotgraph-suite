// src/modules/query-builder/querySubNav.tsx
import React from "react";
import TypeListFilter from "../../components/TypeListFilter";

export const queryBuilderSubNav = {
  title: "Query Builder",
  ctas: [
    {
      label: "Create new query",
      href: "/queries",
      variant: "dark" as const,
      size: "sm" as const,
      modal: {
        show: false,
        title: "Create new query",
        body: (onTypeSelect: (typeIdentifier: string) => void) => (
          <div>
            <div className="mb-3">
              <label className="form-label fw-bold">
                Type the query starts from <span className="text-danger fw-bold">*</span>
              </label>
            </div>
            <TypeListFilter onTypeSelect={onTypeSelect} />
          </div>
        ),
        // The id of the new query is generated on the client - it is marked as new since it is not known to the core yet
        createHref: (typeIdentifier: string) =>
          `/queries/${crypto.randomUUID()}?new=1&type=${encodeURIComponent(typeIdentifier)}`,
      },
    },
  ],
};
