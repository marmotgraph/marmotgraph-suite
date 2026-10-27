import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import InstanceInfo from "./InstanceInfo";
import { fetchInstanceInformation } from "../services/instances";

vi.mock("../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});

vi.mock("../services/instances", () => ({
  fetchInstanceInformation: vi.fn(),
}));

function valueOf(label: string) {
  return screen.getByText(label).closest("div") as HTMLElement;
}

describe("InstanceInfo", () => {
  beforeEach(() => {
    vi.mocked(fetchInstanceInformation).mockReset();
  });

  it("shows the timestamps and the contributors", async () => {
    vi.mocked(fetchInstanceInformation).mockResolvedValue({
      createdAt: "2026-01-02T10:00:00Z",
      lastModified: "2026-04-05T13:30:00Z",
      firstReleased: "2026-02-03T11:00:00Z",
      lastReleased: "2026-03-04T12:00:00Z",
      contributors: [
        { username: "jdoe", name: "Jane Doe" },
        { username: "bot", name: "bot" },
      ],
    });
    render(<InstanceInfo instanceId="abc" />);

    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jdoe")).toBeInTheDocument();
    expect(screen.getByText("bot")).toBeInTheDocument();
    expect(
      within(valueOf("Last modified")).getByTitle("2026-04-05T13:30:00Z"),
    ).toBeInTheDocument();
    expect(
      within(valueOf("Last released")).getByTitle("2026-03-04T12:00:00Z"),
    ).toBeInTheDocument();
    expect(fetchInstanceInformation).toHaveBeenCalledWith("token", "abc");
  });

  it("tells when the instance has never been released and has no contributors", async () => {
    vi.mocked(fetchInstanceInformation).mockResolvedValue({
      createdAt: "2026-01-02T10:00:00Z",
      lastModified: "2026-01-02T10:00:00Z",
      contributors: [],
    });
    render(<InstanceInfo instanceId="abc" />);

    expect(await screen.findByText("No contributors known.")).toBeInTheDocument();
    expect(within(valueOf("Last released")).getByText("Never released")).toBeInTheDocument();
    expect(within(valueOf("First released")).getByText("Never released")).toBeInTheDocument();
  });

  it("allows to retry after a failure", async () => {
    vi.mocked(fetchInstanceInformation)
      .mockRejectedValueOnce(new Error("Boom"))
      .mockResolvedValue({ contributors: [] });
    render(<InstanceInfo instanceId="abc" />);

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No contributors known.")).toBeInTheDocument();
  });
});
