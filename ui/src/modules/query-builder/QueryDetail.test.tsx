import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryDetail } from "./QueryDetail";
import { fetchQuery } from "../../services/queries";
import { HttpError } from "../../services/http";

vi.mock("../../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});
// Stable results - like the shared ones of the real hooks (new objects per render would load the query again and again)
const loaded = vi.hoisted(() => ({ types: { data: {} }, spaces: { data: [] } }));
vi.mock("./useQueryBuilderData", () => ({
  useQueryTypes: () => loaded.types,
  useQuerySpaces: () => loaded.spaces,
  findSpace: () => undefined,
  spaceLabel: () => "",
}));
vi.mock("../../services/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/queries")>()),
  fetchQuery: vi.fn(),
}));

function renderDetail(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/queries/:queryId" element={<QueryDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QueryDetail - a query which can't be shown", () => {
  // In braces: a function returned by beforeEach (mockReset returns the mock) would be run as cleanup after each test
  beforeEach(() => {
    vi.mocked(fetchQuery).mockReset();
  });

  it("is reported as not found with the way back to the queries", async () => {
    vi.mocked(fetchQuery).mockRejectedValue(new HttpError("Failed to load the query (404 Not Found)", 404));
    renderDetail("/queries/missing-1");

    expect(await screen.findByRole("heading", { level: 1, name: "Query not found" })).toBeInTheDocument();
    expect(screen.getByText("missing-1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the queries" })).toHaveAttribute("href", "/queries");
    expect(document.querySelector(".layout-not-found-illustration svg")).toBeInTheDocument();
  });

  it("reports other failures with their reason instead of as not found", async () => {
    vi.mocked(fetchQuery).mockRejectedValue(new HttpError("Failed to load the query (403 Forbidden)", 403));
    renderDetail("/queries/secret-1");

    expect(await screen.findByRole("heading", { level: 1, name: "The query could not be loaded" })).toBeInTheDocument();
    expect(screen.getByText("Error 403")).toBeInTheDocument();
    expect(screen.getByText("Failed to load the query (403 Forbidden)")).toBeInTheDocument();
    // A refused request (4xx) shows the eagle - not the outage or the lost marmot
    expect(document.querySelector(".layout-not-found-illustration title")).toHaveTextContent("An eagle snatches a marmot");
  });

  it("explains a link to a new query without type", async () => {
    renderDetail("/queries/new-1?new=1");

    expect(await screen.findByRole("heading", { level: 1, name: "The query can't be created" })).toBeInTheDocument();
    expect(screen.getByText("No type is given to create the query for.")).toBeInTheDocument();
    expect(fetchQuery).not.toHaveBeenCalled();
  });
});
