import React from "react";
import { Blocks, ChartColumn, ChartScatter, CodeXml, Edit3Icon, Network } from "lucide-react";
import { modelerAvailable } from "../../services/modeler";

export interface SuiteModule {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  /** Whether the module is offered to the user - given the global functionalities (undefined while loading). */
  available?: (functionalities: string[] | undefined) => boolean;
}

const ICON_SIZE = 22;

/** The modules of the suite - in the order they are shown on the home screen. */
export const SUITE_MODULES: SuiteModule[] = [
  {
    id: "editor",
    title: "Editor",
    description: "Browse, search and edit the instances in the graph.",
    path: "/editor",
    icon: React.createElement(Edit3Icon, { size: ICON_SIZE }),
  },
  {
    id: "query-builder",
    title: "Query Builder",
    description: "Build, test and share queries to extract data from the graph.",
    path: "/queries",
    icon: React.createElement(Blocks, { size: ICON_SIZE }),
  },
  {
    id: "visualizer",
    title: "Visualizer",
    description: "Explore the instances and their relations as a graph.",
    path: "/visualizer",
    icon: React.createElement(ChartScatter, { size: ICON_SIZE }),
  },
  {
    id: "modeler",
    title: "Modeler",
    description: "Define the types, properties and validation schemas of the data model.",
    path: "/modeler",
    icon: React.createElement(Network, { size: ICON_SIZE }),
    available: modelerAvailable,
  },
  {
    id: "statistics",
    title: "Statistics",
    description: "See how much data the graph holds and how well it complies with its schemas.",
    path: "/statistics",
    icon: React.createElement(ChartColumn, { size: ICON_SIZE }),
  },
  {
    id: "api",
    title: "APIs",
    description: "Programmatic access to the graph for your own tools and scripts.",
    path: "/core-api",
    icon: React.createElement(CodeXml, { size: ICON_SIZE }),
  },
];
