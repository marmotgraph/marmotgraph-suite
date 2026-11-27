import { moveInstance, updateInstance } from "../services/instances";
import { persistUnsavedDraft } from "./persistUnsavedDraft";

vi.mock("../services/instances", () => ({
  createInstance: vi.fn(),
  moveInstance: vi.fn(),
  replaceRawInstance: vi.fn(),
  updateInstance: vi.fn(),
}));

const stored = {
  instanceId: "inst-1",
  type: "Building",
  instanceName: "Headquarters",
  space: "shared",
  permissions: "View, Edit",
  releaseStatus: "in progress" as const,
};

describe("persistUnsavedDraft", () => {
  it("moves an existing instance after its fields are saved", async () => {
    vi.mocked(updateInstance).mockResolvedValue({ ...stored, space: "private-1" });
    vi.mocked(moveInstance).mockResolvedValue(stored);

    await persistUnsavedDraft("token", {
      instanceId: "inst-1",
      instanceName: "Headquarters",
      type: "Building",
      fieldValues: { name: "HQ" },
      baseline: { name: "Headquarters" },
      moveToSpace: "shared",
      updatedAt: 1,
    });

    expect(updateInstance).toHaveBeenCalledWith("token", "inst-1", { name: "HQ" });
    expect(moveInstance).toHaveBeenCalledWith("token", "inst-1", "shared");
  });

  it("only moves when the fields are unchanged", async () => {
    vi.mocked(moveInstance).mockResolvedValue(stored);

    await persistUnsavedDraft("token", {
      instanceId: "inst-1",
      instanceName: "Headquarters",
      type: "Building",
      fieldValues: { name: "Headquarters" },
      baseline: { name: "Headquarters" },
      moveToSpace: "shared",
      updatedAt: 1,
    });

    expect(updateInstance).not.toHaveBeenCalled();
    expect(moveInstance).toHaveBeenCalledWith("token", "inst-1", "shared");
  });
});
