import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import InstanceRelease from "./InstanceRelease";
import {
  fetchReleaseTree,
  ReleaseNode,
  releaseInstance,
  unreleaseInstance,
} from "../services/instances";

vi.mock("../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});

vi.mock("../services/instances", () => ({
  fetchReleaseTree: vi.fn(),
  releaseInstance: vi.fn(),
  unreleaseInstance: vi.fn(),
}));

const tree: ReleaseNode = {
  instanceId: "top",
  instanceName: "Headquarters",
  type: "Building",
  releaseStatus: "has changed",
  canRelease: true,
  canUnrelease: true,
  children: [
    {
      instanceId: "room",
      instanceName: "Server room",
      type: "Room",
      releaseStatus: "in progress",
      canRelease: true,
      canUnrelease: true,
      children: [],
    },
    {
      instanceId: "rack",
      instanceName: "Rack A1",
      type: "Rack",
      releaseStatus: "released",
      canRelease: false,
      canUnrelease: false,
      children: [],
    },
  ],
};

function row(name: string) {
  return screen.getByText(name).closest("li") as HTMLElement;
}

describe("InstanceRelease", () => {
  beforeEach(() => {
    vi.mocked(fetchReleaseTree).mockReset().mockResolvedValue(tree);
    vi.mocked(releaseInstance).mockReset().mockResolvedValue();
    vi.mocked(unreleaseInstance).mockReset().mockResolvedValue();
  });

  it("lists the instances of the release tree with their status", async () => {
    render(<InstanceRelease instanceId="top" onInstanceClick={vi.fn()} />);

    expect(await screen.findByText("Headquarters")).toBeInTheDocument();
    expect(within(row("Server room")).getByText("in progress")).toBeInTheDocument();
    expect(
      within(row("Rack A1")).getByLabelText(
        "You are not allowed to release this instance",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Proceed/ })).toBeDisabled();
  });

  it("hides the released parts of the tree", async () => {
    render(<InstanceRelease instanceId="top" onInstanceClick={vi.fn()} />);
    await screen.findByText("Headquarters");

    fireEvent.click(screen.getByLabelText("Hide released instances"));

    expect(screen.queryByText("Rack A1")).not.toBeInTheDocument();
    expect(screen.getByText("Server room")).toBeInTheDocument();
  });

  it("carries out the chosen actions when proceeding", async () => {
    render(<InstanceRelease instanceId="top" onInstanceClick={vi.fn()} />);
    await screen.findByText("Headquarters");

    fireEvent.click(
      within(row("Server room")).getByRole("button", { name: "Release" }),
    );
    fireEvent.click(
      within(row("Headquarters")).getByRole("button", { name: "Unrelease" }),
    );
    expect(screen.getByText("1 to release · 1 to unrelease")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Proceed/ }));

    expect(
      await screen.findByText(/2 of 2 changes carried out/),
    ).toBeInTheDocument();
    expect(releaseInstance).toHaveBeenCalledWith("token", "room");
    expect(unreleaseInstance).toHaveBeenCalledWith("token", "top");
    expect(fetchReleaseTree).toHaveBeenCalledTimes(2);
  });

  it("marks all releasable instances and reports failed releases", async () => {
    vi.mocked(releaseInstance).mockImplementation((_token, id) =>
      id === "room"
        ? Promise.reject(new Error("Failed to release the instance (403)"))
        : Promise.resolve(),
    );
    render(<InstanceRelease instanceId="top" onInstanceClick={vi.fn()} />);
    await screen.findByText("Headquarters");

    fireEvent.click(screen.getByRole("button", { name: /Release all/ }));
    expect(screen.getByText("2 to release · 0 to unrelease")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Proceed/ }));

    expect(
      await screen.findByText(/Failed to release the instance \(403\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 changes carried out/)).toBeInTheDocument();
  });

  it("opens an instance of the tree", async () => {
    const onInstanceClick = vi.fn();
    render(
      <InstanceRelease instanceId="top" onInstanceClick={onInstanceClick} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Rack A1" }));

    expect(onInstanceClick).toHaveBeenCalledWith("rack");
  });
});
