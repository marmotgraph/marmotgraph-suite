export type Instance = {
  id: number;
  instanceId: string;
  type: string;
  instanceName: string;
  space: string;
  permissions: string;
  bookmarked: boolean;
};

export const mockInstances: Instance[] = [
  {
    id: 1,
    instanceId: "inst-47b94e45-5435-49a8-aba3-3d482fabced3",
    type: "Appliance",
    instanceName: "Server-Rack-A1",
    space: "private-25ae0198-753b-497d-9163-67488442f64",
    permissions: "View, Edit",
    bookmarked: true
  },
  {
    id: 2,
    instanceId: "inst-a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
    type: "Building",
    instanceName: "Data Center North",
    space: "shared-infrastructure-workspace",
    permissions: "View",
    bookmarked: false
  },
  {
    id: 3,
    instanceId: "inst-302a3695-722c-4e29-9543-8f6a7b8c9d0e",
    type: "Cabinet",
    instanceName: "Storage-Cabinet-B3",
    space: "private-302a3695-722c-4e29-9543-8f6a",
    permissions: "View, Edit, Share",
    bookmarked: true
  },
  {
    id: 4,
    instanceId: "inst-b2c3d4e5-f6a7-4b5c-8d9e-0f1a2b3c4d5e",
    type: "Blade",
    instanceName: "Compute-Blade-12",
    space: "team-compute-ops",
    permissions: "View, Edit",
    bookmarked: false
  },
  {
    id: 5,
    instanceId: "inst-c3d4e5f6-a7b8-4c5d-9e0f-1a2b3c4d5e6f",
    type: "Asset Tag",
    instanceName: "Asset-2023-1547",
    space: "private-25ae0198-753b-497d-9163-67488442f64",
    permissions: "View",
    bookmarked: true
  },
  {
    id: 6,
    instanceId: "inst-d4e5f6a7-b8c9-4d5e-0f1a-2b3c4d5e6f7a",
    type: "Building",
    instanceName: "Office Complex Alpha",
    space: "shared-facilities-workspace",
    permissions: "View, Edit, Delete",
    bookmarked: false
  },
  {
    id: 7,
    instanceId: "inst-7f8e9d0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
    type: "Appliance",
    instanceName: "Network-Switch-Core-1",
    space: "private-7f8e9d0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
    permissions: "View, Edit",
    bookmarked: true
  },
  {
    id: 8,
    instanceId: "inst-e5f6a7b8-c9d0-4e5f-1a2b-3c4d5e6f7a8b",
    type: "Cabinet",
    instanceName: "Server-Cabinet-C5",
    space: "team-infrastructure-ops",
    permissions: "View",
    bookmarked: false
  },
  {
    id: 9,
    instanceId: "inst-f6a7b8c9-d0e1-4f5a-2b3c-4d5e6f7a8b9c",
    type: "Canton",
    instanceName: "Zurich-Site-Main",
    space: "shared-location-workspace",
    permissions: "View, Edit, Share",
    bookmarked: true
  },
  {
    id: 10,
    instanceId: "inst-a7b8c9d0-e1f2-4a5b-3c4d-5e6f7a8b9c0d",
    type: "Blade",
    instanceName: "GPU-Blade-Tesla-8",
    space: "private-25ae0198-753b-497d-9163-67488442f64",
    permissions: "View, Edit",
    bookmarked: false
  }
];
