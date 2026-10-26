import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("loads the next five when more than a page remains", () => {
    render(
      <IncomingLinksPanel
        incomingLinks={links(["One", "Two"], 25, "m1")}
        onLinkClick={() => undefined}
        onLoadMore={() => undefined}
        isLoadingMore={() => false}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Show 5 more" }),
    ).toBeInTheDocument();
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
