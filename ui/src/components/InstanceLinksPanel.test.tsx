import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LinkedInstance } from "../modules/editor/editorMockData";
import InstanceLinksPanel from "./InstanceLinksPanel";

const links = (count: number): LinkedInstance[] =>
  Array.from({ length: count }, (_, i) => ({
    instanceId: `id-${i + 1}`,
    instanceName: `Person ${i + 1}`,
    type: "Person",
    space: "demo",
    fieldLabel: "Authors",
  }));

const renderPanel = (count: number, onLinkClick = vi.fn()) =>
  render(<InstanceLinksPanel links={links(count)} onLinkClick={onLinkClick} title="Outgoing Links" />);

describe("outgoing link pages", () => {
  it("shows up to five links without any option to show more", () => {
    renderPanel(5);

    expect(screen.getByText("Person 5")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show/ })).not.toBeInTheDocument();
  });

  it("shows the first five and unfolds the rest of up to ten links", () => {
    renderPanel(8);

    expect(screen.getByText("Person 5")).toBeInTheDocument();
    expect(screen.queryByText("Person 6")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(screen.getByText("Person 8")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show .* more/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByText("Person 6")).not.toBeInTheDocument();
  });

  it("unfolds exactly ten links in the panel", () => {
    renderPanel(10);

    fireEvent.click(screen.getByRole("button", { name: "Show 5 more" }));

    expect(screen.getByText("Person 10")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists more than ten links in a dialog and does not unfold them", () => {
    const onLinkClick = vi.fn();
    renderPanel(12, onLinkClick);

    expect(screen.queryByRole("button", { name: /Show .* more/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Person 6")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all 12 Person links in Authors" }));

    const dialog = screen.getByRole("dialog", { name: /Outgoing links · Authors/ });
    expect(within(dialog).getByText("12")).toBeInTheDocument();
    expect(within(dialog).getByText("Person 12")).toBeInTheDocument();

    // Opening one of them leaves the dialog
    fireEvent.click(within(dialog).getByText("Person 12"));
    expect(onLinkClick).toHaveBeenCalledWith("id-12");
  });
});
