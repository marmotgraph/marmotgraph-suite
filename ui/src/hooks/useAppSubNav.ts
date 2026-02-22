// src/hooks/useAppSubNav.ts
import { useLocation } from "react-router-dom";
import { queryBuilderSubNav } from "../modules/query-builder/querySubNav";
import { editorSubNav } from "../modules/editor/editorSubNav";
import { visualizerSubNav } from "../modules/visualizer/visualizerSubNav";

export function useAppSubNav() {
  const { pathname } = useLocation();

  // Home page – no sub‑nav
  if (pathname === "/" || pathname === "/home") {
    return undefined;
  }

  // Other routes
  if (/^\/queries/.test(pathname)) return queryBuilderSubNav;
  if (/^\/editor/.test(pathname)) return editorSubNav;
  if (/^\/visualizer/.test(pathname)) return visualizerSubNav;

  // Fallback – no sub‑nav
  return undefined;
}
