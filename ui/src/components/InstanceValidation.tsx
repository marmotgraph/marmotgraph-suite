import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { InstanceValidation } from "../modules/editor/editorMockData";
import "./InstanceValidation.css";

/** A violation of a validation schema as shown with the field it concerns. */
export type FieldValidationError = {
  schema: string;
  message: string;
};

function formatCompliance(compliance: number) {
  return `${Math.floor(compliance)}%`;
}

/** One validation schema: an icon telling whether the instance is valid, the name and its compliance. */
export function ValidationStatus({
  validation,
  variant = "bar",
}: {
  validation: InstanceValidation;
  /** A list badge names the schema. The bar and percent sit beside it. The full bar is for the instance page. */
  variant?: "bar" | "badge";
}) {
  const state = validation.valid ? "valid" : "invalid";
  const compliance =
    validation.compliance != null
      ? Math.min(100, Math.max(0, validation.compliance))
      : null;
  const description = `Validation "${validation.name}": ${state}${compliance != null ? ` (${formatCompliance(compliance)} compliant)` : ""}`;
  if (variant === "badge") {
    return (
      <span
        className={`instance-validation-result instance-validation-result--${state}`}
        title={description}
      >
        <span className="instance-validation-badge">
          <FontAwesomeIcon
            icon={validation.valid ? faCircleCheck : faTriangleExclamation}
            aria-hidden="true"
          />
          <span className="instance-validation-badge-name">
            {validation.name}
          </span>
        </span>
        {compliance != null && (
          <span className="instance-validation-measure">
            <span className="instance-validation-badge-bar" aria-hidden="true">
              <span
                className="instance-validation-badge-bar-fill"
                style={{ width: `${compliance}%` }}
              />
            </span>
            <span className="instance-validation-badge-value">
              {formatCompliance(compliance)}
            </span>
          </span>
        )}
      </span>
    );
  }
  return (
    <div
      className={`instance-validation instance-validation--${state}`}
      title={description}
    >
      <FontAwesomeIcon
        icon={validation.valid ? faCircleCheck : faTriangleExclamation}
        className="instance-validation-icon"
        aria-label={state}
      />
      <span className="instance-validation-name">{validation.name}</span>
      {compliance != null ? (
        <>
          <span className="instance-validation-bar" aria-hidden="true">
            <span
              className="instance-validation-bar-fill"
              style={{ width: `${compliance}%` }}
            />
          </span>
          <span className="instance-validation-value">
            {formatCompliance(compliance)}
          </span>
        </>
      ) : (
        <span className="instance-validation-unknown" />
      )}
    </div>
  );
}

/** The errors of the validations by the identifier of the field they concern - errors of no field are left out. */
export function validationErrorsByField(
  validation: InstanceValidation[] | undefined,
): Map<string, FieldValidationError[]> {
  const byField = new Map<string, FieldValidationError[]>();
  validation?.forEach(({ name, errors }) =>
    errors?.forEach(({ field, message }) => {
      if (field) {
        byField.set(field, [...(byField.get(field) ?? []), { schema: name, message }]);
      }
    }),
  );
  return byField;
}

/**
 * The results of the last validation of an instance per validation schema - with the errors of the failed ones,
 * labeled with the field they concern.
 */
export function InstanceValidationSummary({
  validation,
  fieldLabels,
}: {
  validation: InstanceValidation[];
  /** The labels of the fields by their identifier */
  fieldLabels: Map<string, string>;
}) {
  const errorCount = validation.reduce((count, v) => count + (v.errors?.length ?? 0), 0);
  return (
    <section className="instance-validation-summary" aria-label="Validation">
      <div className="instance-validation-summary-title">
        Validation
        {errorCount > 0 && (
          <span className="instance-validation-summary-count">
            {errorCount} {errorCount === 1 ? "error" : "errors"}
          </span>
        )}
      </div>
      <div className="instance-validations instance-validations--detail">
        {validation.map((v) => (
          <React.Fragment key={v.name}>
            <ValidationStatus validation={v} />
            {v.errors && v.errors.length > 0 && (
              <ul className="instance-validation-errors">
                {v.errors.map((error, index) => (
                  <li key={index} className="instance-validation-error">
                    {error.field && (
                      <span className="instance-validation-error-field">
                        {fieldLabels.get(error.field) ?? error.field}
                      </span>
                    )}
                    <span className="instance-validation-error-message">{error.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

/** Flags a field in its label - the errors are told by the title (and listed below the field). */
export function FieldValidationIndicator({ errors }: { errors: FieldValidationError[] }) {
  return (
    <FontAwesomeIcon
      icon={faTriangleExclamation}
      className="instance-field-validation-icon"
      title={`${errors.length} validation ${errors.length === 1 ? "error" : "errors"}`}
    />
  );
}

/** The errors of the validations concerning a field - shown below it. */
export function FieldValidationErrors({ errors }: { errors: FieldValidationError[] }) {
  return (
    <ul className="instance-field-validation-errors" aria-label="Validation errors">
      {errors.map((error, index) => (
        <li key={index}>
          {error.message}
          <span className="instance-field-validation-schema"> · {error.schema}</span>
        </li>
      ))}
    </ul>
  );
}
