import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import InstanceRelease from "./InstanceRelease";
import {
  batchRelease,
  batchUnrelease,
  fetchReleaseTree,
  ReleaseNode,
} from "../services/instances";

vi.mock("../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});

vi.mock("../services/instances", () => ({
  fetchReleaseTree: vi.fn(),
  batchRelease: vi.fn(),
  batchUnrelease: vi.fn(),
}));

/** The outcome of a batch - the instances given with an error have failed */
function outcome(ids: string[], errors: Record<string, string> = {}) {
  const items = ids.map((instanceId) =>
    errors[instanceId]
      ? { instanceId, succeeded: false, error: errors[instanceId] }
      : { instanceId, succeeded: true },
  );
  const succeeded = items.filter((item) => item.succeeded).length;
  return { succeeded, failed: items.length - succeeded, items };
}

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
    vi.mocked(batchRelease)
      .mockReset()
      .mockImplementation((_token, ids) => Promise.resolve(outcome(ids)));
    vi.mocked(batchUnrelease)
      .mockReset()
      .mockImplementation((_token, ids) => Promise.resolve(outcome(ids)));
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
    expect(batchRelease).toHaveBeenCalledWith("token", ["room"]);
    expect(batchUnrelease).toHaveBeenCalledWith("token", ["top"]);
    // The tree is reloaded once all changes have been carried out
    await waitFor(() => expect(fetchReleaseTree).toHaveBeenCalledTimes(2));
  });

  it("marks all releasable instances and reports failed releases", async () => {
    vi.mocked(batchRelease).mockImplementation((_token, ids) =>
      Promise.resolve(outcome(ids, { room: "Failed to release the instance (403)" })),
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
    // All releases are sent at once
    expect(batchRelease).toHaveBeenCalledTimes(1);
    expect(batchRelease).toHaveBeenCalledWith("token", ["top", "room"]);
    expect(batchUnrelease).not.toHaveBeenCalled();
  });

  it("reports every instance of a rejected batch as failed", async () => {
    vi.mocked(batchRelease).mockRejectedValue(
      new Error("Failed to release the instances (401 Unauthorized)"),
    );
    render(<InstanceRelease instanceId="top" onInstanceClick={vi.fn()} />);
    await screen.findByText("Headquarters");

    fireEvent.click(screen.getByRole("button", { name: /Release all/ }));
    fireEvent.click(screen.getByRole("button", { name: /Proceed/ }));

    expect(
      await screen.findByText(/0 of 2 changes carried out/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Failed to release the instances \(401 Unauthorized\)/),
    ).toHaveLength(2);
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
