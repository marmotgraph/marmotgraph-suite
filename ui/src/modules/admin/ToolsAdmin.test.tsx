import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ToolsAdmin from "./ToolsAdmin";
import { deleteToolCategory, fetchToolCategories, fetchToolDefinitions, saveTool } from "../../services/tools";

const auth = vi.hoisted(() => ({ getAccessToken: () => Promise.resolve("token") }));
const reload = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../contexts/ToolsContext", () => ({ useTools: () => ({ reload }) }));
vi.mock("../../services/tools", async (original) => ({
  ...(await original<object>()),
  fetchToolCategories: vi.fn(),
  fetchToolDefinitions: vi.fn(),
  saveTool: vi.fn(),
  saveToolCategory: vi.fn(),
  deleteTool: vi.fn(),
  deleteToolCategory: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchToolCategories).mockResolvedValue([
    { id: "search", name: "Search" },
    { id: "empty", name: "Dashboards" },
  ]);
  vi.mocked(fetchToolDefinitions).mockResolvedValue([
    {
      id: "t1",
      name: "Dataset search",
      category: { id: "search", name: "Search" },
      endpoint: "https://search.example.org",
      claims: { groups: ["^/curators$"] },
    },
  ]);
  vi.mocked(saveTool).mockResolvedValue({} as never);
  vi.mocked(deleteToolCategory).mockResolvedValue();
});

describe("ToolsAdmin", () => {
  it("lists the tools by category with who gets them listed", async () => {
    render(<ToolsAdmin />);

    expect(await screen.findByText("Dataset search")).toBeInTheDocument();
    expect(screen.getByText('{"groups":["^/curators$"]}')).toBeInTheDocument();
    expect(screen.getByText("No tools are registered in this category.")).toBeInTheDocument();
    expect(screen.getByText("1 tool in 2 categories")).toBeInTheDocument();
  });

  it("only allows to delete categories without tools", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ToolsAdmin />);
    await screen.findByText("Dataset search");

    expect(screen.getByRole("button", { name: "Delete category (Search)" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Delete category (Dashboards)" }));

    await waitFor(() => expect(deleteToolCategory).toHaveBeenCalledWith("token", "empty"));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("adds a tool listed to every authenticated user by default", async () => {
    render(<ToolsAdmin />);
    await screen.findByText("Dataset search");

    fireEvent.click(screen.getByRole("button", { name: "Add tool (Dashboards)" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Overview" } });
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "https://dashboard.example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saveTool).toHaveBeenCalledWith(
        "token",
        { name: "Overview", description: undefined, categoryId: "empty", endpoint: "https://dashboard.example.org", claims: { authenticated: true } },
        undefined,
      ),
    );
  });

  it("requires an http(s) URL", async () => {
    render(<ToolsAdmin />);
    await screen.findByText("Dataset search");

    fireEvent.click(screen.getByRole("button", { name: "Add tool (Search)" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Overview" } });
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "ftp://example.org" } });

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
