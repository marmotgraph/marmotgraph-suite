import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LinkedInstance } from "../modules/editor/editorMockData";
import InstanceLinksPanel, { FieldGroup, TypeGroup } from "./InstanceLinksPanel";

describe("link groups", () => {
  it("lets a property hide its instances and keeps the type attached to them", () => {
    render(
      <FieldGroup label="Contains" count={2}>
        <TypeGroup type="Cabinet" typeColor="#f44336" count={2}>
          <div>Rack A</div>
        </TypeGroup>
      </FieldGroup>,
    );

    const property = screen.getByRole("button", { name: /Contains/ });
    expect(property).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Cabinet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cabinet/ })).not.toBeInTheDocument();
    expect(screen.getByText("Rack A")).toBeInTheDocument();

    fireEvent.click(property);

    expect(property).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Cabinet")).not.toBeInTheDocument();
    expect(screen.queryByText("Rack A")).not.toBeInTheDocument();
  });

  it("shows a first page of outgoing links and reveals the rest on request", () => {
    const links: LinkedInstance[] = Array.from({ length: 7 }, (_, index) => ({
      instanceId: `id-${index}`,
      instanceName: `Rack ${index}`,
      type: "Cabinet",
      space: "demo",
      fieldLabel: "Contains",
    }));

    render(
      <InstanceLinksPanel
        links={links}
        onLinkClick={() => undefined}
        title="Outgoing Links"
      />,
    );

    expect(screen.getAllByText(/Rack /)).toHaveLength(5);
    expect(screen.queryByText("Rack 5")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit instance" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));

    expect(screen.getAllByText(/Rack /)).toHaveLength(7);
    expect(screen.queryByRole("button", { name: /Show .* more/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));

    expect(screen.getAllByText(/Rack /)).toHaveLength(5);
    expect(screen.queryByText("Rack 5")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 2 more" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show less" })).not.toBeInTheDocument();
  });
});
