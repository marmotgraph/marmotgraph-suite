import type { SearchResult } from "../types/searchTypes";

export const SEARCH_MOCK_RESULTS: SearchResult[] = [
  {
    id: "inst_001",
    name: "climate_sim_v3",
    type: "Appliance",
    space: "hpc-climate",
    description:
      "High-resolution climate simulation appliance for regional forecasting.",
    lastModified: "2026-06-08",
  },
  {
    id: "inst_002",
    name: "genomics_align",
    type: "Blade",
    space: "bioinformatics",
    description: "Genomics alignment blade cluster node.",
    lastModified: "2026-06-07",
  },
  {
    id: "inst_003",
    name: "ml_training_r2",
    type: "Appliance",
    space: "ai-research",
    description: "Machine learning training appliance with GPU allocation.",
    lastModified: "2026-06-06",
  },
  {
    id: "inst_004",
    name: "protein_fold_01",
    type: "Cabinet",
    space: "bioinformatics",
    description: "Protein folding compute cabinet.",
    lastModified: "2026-06-05",
  },
  {
    id: "inst_005",
    name: "datacenter_zurich",
    type: "Building",
    space: "infrastructure",
    description: "Primary datacenter building in Zurich region.",
    lastModified: "2026-06-04",
  },
  {
    id: "inst_006",
    name: "rack_a14",
    type: "Cabinet",
    space: "infrastructure",
    description: "Rack A14 in Zurich datacenter hall 2.",
    lastModified: "2026-06-03",
  },
  {
    id: "inst_007",
    name: "asset_tag_blade_42",
    type: "Asset Tag",
    space: "inventory",
    description: "Physical asset tag for blade server 42.",
    lastModified: "2026-06-02",
  },
  {
    id: "inst_008",
    name: "canton_bern",
    type: "Canton",
    space: "geography",
    description: "Geographic canton entity for Bern.",
    lastModified: "2026-06-01",
  },
  {
    id: "inst_009",
    name: "fluid_dynamics_solver",
    type: "Appliance",
    space: "hpc-climate",
    description: "CFD solver appliance for turbulence modeling.",
    lastModified: "2026-05-30",
  },
  {
    id: "inst_010",
    name: "neural_net_cluster",
    type: "Blade",
    space: "ai-research",
    description: "Distributed neural network training blade.",
    lastModified: "2026-05-28",
  },
  {
    id: "inst_011",
    name: "storage_array_nas1",
    type: "Appliance",
    space: "storage",
    description: "Network-attached storage appliance tier 1.",
    lastModified: "2026-05-25",
  },
  {
    id: "inst_012",
    name: "building_geneva",
    type: "Building",
    space: "infrastructure",
    description: "Secondary datacenter building in Geneva.",
    lastModified: "2026-05-22",
  },
  {
    id: "inst_013",
    name: "blade_compute_128",
    type: "Blade",
    space: "hpc-climate",
    description: "128-core compute blade for batch workloads.",
    lastModified: "2026-05-20",
  },
  {
    id: "inst_014",
    name: "cabinet_row_c3",
    type: "Cabinet",
    space: "infrastructure",
    description: "Cabinet row C3 in Geneva datacenter.",
    lastModified: "2026-05-18",
  },
  {
    id: "inst_015",
    name: "appliance_monitoring",
    type: "Appliance",
    space: "operations",
    description: "Cluster health monitoring appliance.",
    lastModified: "2026-05-15",
  },
];

export const SEARCH_AVAILABLE_TYPES = [
  "Appliance",
  "Asset Tag",
  "Blade",
  "Building",
  "Cabinet",
  "Canton",
] as const;

export const SEARCH_AVAILABLE_SPACES = [
  "ai-research",
  "bioinformatics",
  "geography",
  "hpc-climate",
  "infrastructure",
  "inventory",
  "operations",
  "storage",
] as const;

export const SEARCH_SUGGESTIONS = [
  "climate simulation",
  "genomics",
  "datacenter",
  "blade cluster",
  "protein folding",
] as const;

/** Type accent colors mapped to HPC palette blues and slates. */
export const SEARCH_TYPE_COLORS: Record<string, string> = {
  Appliance: "#2b6cb0",
  "Asset Tag": "#4a6278",
  Blade: "#1a4e8a",
  Building: "#8fa8c0",
  Cabinet: "#2b6cb0",
  Canton: "#4a6278",
};

export const SEARCH_PAGE_SIZE = 6;
