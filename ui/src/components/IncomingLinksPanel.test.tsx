import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { IncomingLinks } from "../services/instances";
import IncomingLinksPanel from "./IncomingLinksPanel";

function links(
  names: string[],
  total?: number,
  nextMarker?: string,
): IncomingLinks[] {
  return [
    {
      property: "https://example.org/author",
      label: "Author of",
      types: [
        {
          typeIdentifier: "https://example.org/Dataset",
          type: "Dataset",
          links: names.map((instanceName, index) => ({
            instanceId: `id-${index}`,
            instanceName,
            space: "demo",
          })),
          total,
          nextMarker,
        },
      ],
    },
  ];
}

describe("collapsed incoming links", () => {
  const props = {
    onLinkClick: () => undefined,
    onLoadMore: () => undefined,
    isLoadingMore: () => false,
    collapsed: true,
    onToggleCollapsed: () => undefined,
  };

  it("shows an arrow towards the instance on the rail when there are links", () => {
    const { container } = render(<IncomingLinksPanel {...props} incomingLinks={links(["One", "Two"])} />);

    expect(container.querySelector(".links-rail-arrow--incoming")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("One")).not.toBeInTheDocument();
  });

  it("shows no arrow without links", () => {
    const { container } = render(<IncomingLinksPanel {...props} incomingLinks={[]} />);

    expect(container.querySelector(".links-rail-arrow")).not.toBeInTheDocument();
  });
});

describe("incoming link pages", () => {
  it("shows further pages and returns to the first one", () => {
    const onLoadMore = vi.fn();
    const props = {
      onLinkClick: () => undefined,
      onLoadMore,
      isLoadingMore: () => false,
    };
    const { rerender } = render(
      <IncomingLinksPanel
        {...props}
        incomingLinks={links(["One", "Two"], 4, "m1")}
      />,
    );

    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.queryByText("Three")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(
      <IncomingLinksPanel
        {...props}
        incomingLinks={links(["One", "Two", "Three", "Four"], 4)}
      />,
    );

    expect(screen.getByText("Four")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show .* more/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));

    expect(screen.queryByText("Three")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show 2 more" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Four")).toBeInTheDocument();
  });

  const names = (count: number) => Array.from({ length: count }, (_, i) => `Instance ${i + 1}`);
  const renderLinks = (incomingLinks: IncomingLinks[], onLoadMore = vi.fn()) =>
    render(
      <IncomingLinksPanel
        incomingLinks={incomingLinks}
        onLinkClick={() => undefined}
        onLoadMore={onLoadMore}
        isLoadingMore={() => false}
      />,
    );

  it("offers to show what remains up to ten instances", () => {
    renderLinks(links(names(5), 8, "m1"));

    expect(screen.getByRole("button", { name: "Show 3 more" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
  });

  it("offers five more at most - ten instances are still unfolded in the panel", () => {
    renderLinks(links(names(5), 10, "m1"));

    expect(screen.getByRole("button", { name: "Show 5 more" })).toBeInTheDocument();
  });

  it("lists more than ten instances in a dialog instead of unfolding them", () => {
    const onLoadMore = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    renderLinks(links(names(5), 25, "m1"), onLoadMore);

    expect(screen.queryByRole("button", { name: /Show .* more/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all 25 Dataset links in Author of" }));

    const dialog = screen.getByRole("dialog", { name: /Incoming links · Author of/ });
    expect(screen.getByRole("button", { name: /Show all 25 Dataset links/ })).toHaveTextContent("Show all 25 Dataset links");
    expect(within(dialog).getByText("5 of 25")).toBeInTheDocument();
    expect(within(dialog).getByText("Instance 5")).toBeInTheDocument();
    expect(onLoadMore).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("says show more when the remaining number is unknown", () => {
    render(
      <IncomingLinksPanel
        incomingLinks={links(["One", "Two"], undefined, "m1")}
        onLinkClick={() => undefined}
        onLoadMore={() => undefined}
        isLoadingMore={() => false}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Show more" }),
    ).toBeInTheDocument();
  });
});
