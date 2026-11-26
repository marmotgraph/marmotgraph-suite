import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider, useConfig } from "./ConfigContext";

vi.mock("../services/tenants", () => ({ applyTenantStylesheet: vi.fn() }));
vi.mock("../tenants/tenantStyles", () => ({ applyTenantUiStyle: vi.fn(async () => undefined) }));

const CONFIG = { authUrl: "a", authTokenUrl: "t", authClientId: "c", coreUrl: "http://core", tenant: "Test" };

function outageResponse(retryInterval: number) {
  return new Response(JSON.stringify({ detail: "The MarmotGraph core at http://core is not reachable", retryInterval, tenant: "Test" }), {
    status: 503,
    headers: { "Content-Type": "application/problem+json" },
  });
}

function Probe() {
  return <span>Suite for {useConfig().tenant}</span>;
}

async function flush() {
  // Lets the pending fetch and the following state updates settle
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("ConfigProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    localStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the outage page instead of the suite while the core is unreachable - and retries in the interval", async () => {
    fetchMock.mockResolvedValueOnce(outageResponse(3)).mockResolvedValueOnce(new Response(JSON.stringify(CONFIG)));

    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );
    await flush();

    expect(screen.getByRole("heading", { name: "The knowledge graph can't be reached right now" })).toBeTruthy();
    expect(screen.getByText("Test Knowledge Graph Suite")).toBeTruthy();
    expect(screen.getByText("Next attempt in 3s")).toBeTruthy();
    expect(document.querySelector(".outage-illustration svg")).toBeTruthy();
    expect(screen.queryByText("Suite for Test")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText("Next attempt in 1s")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Suite for Test")).toBeTruthy();
  });

  it("retries right away on demand", async () => {
    fetchMock.mockResolvedValueOnce(outageResponse(60)).mockResolvedValueOnce(outageResponse(60));

    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Retry now" }));
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Still not reachable.")).toBeTruthy();
    expect(screen.getByText("Next attempt in 60s")).toBeTruthy();
  });

  it("shows the outage page if the suite backend can't be reached - in the style of the last known tenant", async () => {
    localStorage.setItem("marmotgraph.tenant", "Remembered");
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(new Response(JSON.stringify(CONFIG)));

    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );
    await flush();

    expect(screen.getByRole("heading", { name: "The suite can't be reached right now" })).toBeTruthy();
    expect(screen.getByText("Remembered Knowledge Graph Suite")).toBeTruthy();
    expect(screen.getByText("Next attempt in 10s")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    await flush();

    expect(screen.getByText("Suite for Test")).toBeTruthy();
    expect(localStorage.getItem("marmotgraph.tenant")).toBe("Test");
  });

  it("treats an error page of a proxy in front of the backend as outage of the suite", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>Bad Gateway</html>", { status: 502, statusText: "Bad Gateway", headers: { "Content-Type": "text/html", "Retry-After": "20" } }),
    );

    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );
    await flush();

    expect(screen.getByRole("heading", { name: "The suite can't be reached right now" })).toBeTruthy();
    expect(screen.getByText("Next attempt in 20s")).toBeTruthy();
    expect(screen.getByText("The suite backend is not reachable: 502 Bad Gateway")).toBeTruthy();
  });

  it("keeps reporting failures of the backend itself as error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Boom" }), { status: 500, statusText: "Internal Server Error", headers: { "Content-Type": "application/problem+json" } }),
    );

    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );
    await flush();

    expect(screen.getByText("Failed to load the configuration (500 Internal Server Error): Boom")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry now" })).toBeNull();
  });
});
