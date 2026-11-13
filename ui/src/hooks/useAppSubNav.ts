// src/hooks/useAppSubNav.ts
import { useLocation } from "react-router-dom";
import { queryBuilderSubNav } from "../modules/query-builder/querySubNav";
import { editorSubNav } from "../modules/editor/editorSubNav";
import { visualizerSubNav } from "../modules/visualizer/visualizerSubNav";
import { modelerSubNav } from "../modules/modeler/modelerSubNav";
import { apiSubNav } from "../modules/api/apiSubNav";
import { adminSubNav } from "../modules/admin/adminSubNav";
import { spacesSubNav } from "../modules/spaces/spacesSubNav";
import { statisticsSubNav } from "../modules/statistics/statisticsSubNav";

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
  if (/^\/modeler/.test(pathname)) return modelerSubNav;
  if (/^\/core-api/.test(pathname)) return apiSubNav;
  if (/^\/spaces/.test(pathname)) return spacesSubNav;
  if (/^\/statistics/.test(pathname)) return statisticsSubNav;
  if (/^\/admin/.test(pathname)) return adminSubNav(pathname);

  // Fallback – no sub‑nav
  return undefined;
}
