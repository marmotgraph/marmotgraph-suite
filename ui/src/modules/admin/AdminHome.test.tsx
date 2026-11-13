import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AdminHome from "./AdminHome";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";

vi.mock("./PermissionsAdmin", () => ({ default: () => <div>permissions view</div> }));
vi.mock("./TenantsAdmin", () => ({ default: () => <div>tenants view</div> }));
vi.mock("./ToolsAdmin", () => ({ default: () => <div>tools view</div> }));
vi.mock("../../hooks/useGlobalFunctionalities", () => ({ useGlobalFunctionalities: vi.fn() }));

const ALL = ["CREATE_PERMISSION", "TENANT_MANAGEMENT", "DEFINE_TOOLS"];

function Location() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderAt(path: string, functionalities: string[] | undefined) {
  vi.mocked(useGlobalFunctionalities).mockReturnValue(functionalities);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="admin/*" element={<AdminHome />} />
      </Routes>
      <Location />
    </MemoryRouter>,
  );
}

describe("AdminHome", () => {
  it.each(["/admin", "/admin/", "/admin/permissions", "/admin/unknown"])("shows the permissions for %s", async (path) => {
    renderAt(path, ALL);
    expect(await screen.findByText("permissions view")).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/admin/permissions");
  });

  it("shows the tenants", async () => {
    renderAt("/admin/tenants", ALL);
    expect(await screen.findByText("tenants view")).toBeInTheDocument();
  });

  it("shows no tabs - each section is an entry of the navigation", async () => {
    renderAt("/admin/permissions", ALL);
    expect(await screen.findByText("permissions view")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("Tenants")).not.toBeInTheDocument();
  });

  it("only provides the tenants with tenant management", async () => {
    renderAt("/admin/permissions", ["TENANT_MANAGEMENT"]);
    expect(await screen.findByText("tenants view")).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/admin/tenants");
  });

  it("only provides the permissions with the right to create permissions", async () => {
    renderAt("/admin/tenants", ["CREATE_PERMISSION"]);
    expect(await screen.findByText("permissions view")).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/admin/permissions");
  });

  it("provides nothing without any of the permissions", () => {
    renderAt("/admin", ["READ"]);
    expect(screen.getByText(/don't have the permissions/)).toBeInTheDocument();
    expect(screen.queryByText("permissions view")).not.toBeInTheDocument();
  });

  it("waits for the permissions of the user", () => {
    renderAt("/admin", undefined);
    expect(screen.getByText(/Loading permissions/)).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/admin");
  });
});
