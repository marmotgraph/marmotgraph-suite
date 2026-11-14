/** The text of a single field value - objects (which are not expected here) are shown as JSON instead of "[object Object]". */
export function fieldValueText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return JSON.stringify(value) ?? "";
}
