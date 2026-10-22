import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AdminHome from "./AdminHome";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";

vi.mock("./PermissionsAdmin", () => ({ default: () => <div>permissions view</div> }));
vi.mock("./TenantsAdmin", () => ({ default: () => <div>tenants view</div> }));
vi.mock("../../hooks/useGlobalFunctionalities", () => ({ useGlobalFunctionalities: vi.fn() }));

const ALL = ["CREATE_PERMISSION", "TENANT_MANAGEMENT"];

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

  it("switches between the tabs", async () => {
    renderAt("/admin/permissions", ALL);
    fireEvent.click(screen.getByText("Tenants"));
    expect(await screen.findByText("tenants view")).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/admin/tenants");
    fireEvent.click(screen.getByText("Permissions"));
    expect(await screen.findByText("permissions view")).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/admin/permissions");
  });

  it("only provides the tenants with tenant management", async () => {
    renderAt("/admin/permissions", ["TENANT_MANAGEMENT"]);
    expect(await screen.findByText("tenants view")).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/admin/tenants");
    expect(screen.queryByText("Permissions")).not.toBeInTheDocument();
  });

  it("only provides the permissions with the right to create permissions", async () => {
    renderAt("/admin/tenants", ["CREATE_PERMISSION"]);
    expect(await screen.findByText("permissions view")).toBeInTheDocument();
    expect(screen.queryByText("Tenants")).not.toBeInTheDocument();
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
