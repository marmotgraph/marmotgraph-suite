import React from "react";
import { Wrench } from "lucide-react";
import { iconSource } from "../services/tools";
import "./ToolCategoryIcon.css";

/**
 * The icon of a tool category - a generic one if the category has none. The SVG of the administrators is shown as
 * image, so it can't act on the page.
 */
export default function ToolCategoryIcon({ icon, size }: { icon?: string | null; size: number }) {
  const source = iconSource(icon);
  return source ? (
    <img src={source} alt="" width={size} height={size} className="tool-category-icon" />
  ) : (
    <Wrench size={size} aria-hidden="true" />
  );
}
