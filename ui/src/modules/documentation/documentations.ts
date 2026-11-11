import React from "react";
import { BookOpen, Database, Network } from "lucide-react";
import { AppConfig } from "../../services/config";

export interface DocumentationItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  /** Where the documentation is published - undefined while it doesn't exist (yet), which shows it as unavailable. */
  url?: (config: AppConfig) => string;
}

const ICON_SIZE = 22;

const withTrailingSlash = (url: string) => (url.endsWith("/") ? url : `${url}/`);

/** The standalone documentations - in the order they are shown on the documentation page. */
export const DOCUMENTATIONS: DocumentationItem[] = [
  {
    id: "suite",
    title: "Suite documentation",
    description: "How to work with the modules of the suite - from editing instances to building queries.",
    icon: React.createElement(BookOpen, { size: ICON_SIZE }),
    // Served by the service (see Documentation.java)
    url: () => "/docs/",
  },
  {
    id: "core",
    title: "Core documentation",
    description: "The concepts of MarmotGraph Core - spaces, instances, releases and permissions - and its API.",
    icon: React.createElement(Database, { size: ICON_SIZE }),
    url: ({ coreUrl }) => `${withTrailingSlash(coreUrl)}docs/`,
  },
  {
    id: "model",
    title: "Model documentation",
    description: "The types, properties and spaces of this knowledge graph.",
    icon: React.createElement(Network, { size: ICON_SIZE }),
  },
];
