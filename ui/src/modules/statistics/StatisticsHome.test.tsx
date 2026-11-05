import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import StatisticsHome, { formatShare } from "./StatisticsHome";
import { fetchStatistics, GraphStatistics, ValidationStatistics } from "../../services/statistics";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ getAccessToken: () => Promise.resolve("token") }),
}));
vi.mock("../../services/statistics", () => ({ fetchStatistics: vi.fn() }));

const SCHEMA: ValidationStatistics = {
  schema: "minimal",
  types: 2,
  instances: 200,
  fullyCompliant: 150,
  above80Percent: 40,
  between40And80Percent: 9,
  below40Percent: 1,
  notCompliant: 0,
  notAssessed: 0,
};

const STATISTICS: GraphStatistics = {
  live: { instances: 84, triples: 449 },
  released: { instances: 64, triples: 404 },
  types: [
    { identifier: "https://example.org/Language", name: "Language", color: "#123456", liveInstances: 27, releasedInstances: 20 },
    { identifier: "https://example.org/Animal", name: "Animal", liveInstances: 13, releasedInstances: 0 },
  ],
  validation: [SCHEMA],
};

function show(statistics: GraphStatistics) {
  vi.mocked(fetchStatistics).mockResolvedValue(statistics);
  render(<StatisticsHome />);
}

/** The value next to a term of a definition list. */
function valueOf(term: HTMLElement) {
  return term.parentElement!.querySelector("dd")!.textContent;
}

describe("StatisticsHome", () => {
  it("shows the totals per stage", async () => {
    show(STATISTICS);
    const instances = (await screen.findByRole("heading", { name: "Instances" })).closest("section")!;
    expect(valueOf(within(instances).getByText("Live"))).toBe("84");
    expect(valueOf(within(instances).getByText("Released"))).toBe("64");
    const triples = screen.getByRole("heading", { name: "Triples" }).closest("section")!;
    expect(valueOf(within(triples).getByText("Live"))).toBe("449");
    expect(valueOf(within(triples).getByText("Released"))).toBe("404");
  });

  it("keeps the slots of the totals while loading", () => {
    vi.mocked(fetchStatistics).mockReturnValue(new Promise(() => {}));
    render(<StatisticsHome />);
    expect(screen.getAllByText("–")).toHaveLength(4);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("lists the types in the order of the core and falls back to the neutral color", async () => {
    show(STATISTICS);
    const rows = within(await screen.findByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell").map((c) => c.textContent))).toEqual([
      ["Language", "27", "20"],
      ["Animal", "13", "0"],
    ]);
    expect(rows[0].querySelector(".statistics-type-dot")).toHaveStyle({ backgroundColor: "#123456" });
    expect(rows[1].querySelector(".statistics-type-dot")).toHaveStyle({ backgroundColor: "#6c757d" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the top types until all of them are requested", async () => {
    const types = Array.from({ length: 12 }, (_, i) => ({ identifier: `https://example.org/T${i}`, name: `T${i}`, liveInstances: 12 - i, releasedInstances: 0 }));
    show({ ...STATISTICS, types });
    expect(await screen.findByText("12 types")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(11);
    fireEvent.click(screen.getByRole("button", { name: "Show all 12 types" }));
    expect(screen.getAllByRole("row")).toHaveLength(13);
    fireEvent.click(screen.getByRole("button", { name: "Show the top 10" }));
    expect(screen.getAllByRole("row")).toHaveLength(11);
  });

  it("shows the instances of a schema by compliance", async () => {
    show(STATISTICS);
    expect(await screen.findByRole("heading", { name: "minimal" })).toBeInTheDocument();
    expect(screen.getByText("200 instances · 2 types")).toBeInTheDocument();
    expect(valueOf(screen.getByText("Fully compliant"))).toBe("15075%");
    expect(valueOf(screen.getByText("Almost fully compliant (>80%)"))).toBe("4020%");
    expect(valueOf(screen.getByText("40–80%"))).toBe("95%");
    expect(valueOf(screen.getByText(">0–<40%"))).toBe("1<1%");
    expect(valueOf(screen.getByText("Not compliant"))).toBe("00%");
    const bar = screen.getByRole("img");
    expect(bar).toHaveAccessibleName(expect.stringContaining("Fully compliant: 150 instances (75%)"));
    // groups without instances don't get a segment
    expect(bar.children).toHaveLength(4);
  });

  it("only mentions not assessed instances if there are any", async () => {
    show(STATISTICS);
    await screen.findByRole("heading", { name: "minimal" });
    expect(screen.queryByText("Not assessed")).not.toBeInTheDocument();
  });

  it("shows the not assessed instances", async () => {
    show({ ...STATISTICS, validation: [{ ...SCHEMA, notAssessed: 3, instances: 203 }] });
    expect(await screen.findByText("Not assessed")).toBeInTheDocument();
    expect(screen.getByText(/Not assessed instances have not been validated/)).toBeInTheDocument();
  });

  it("explains when there is nothing to show", async () => {
    show({ live: { instances: 0, triples: 0 }, released: { instances: 0, triples: 0 }, types: [], validation: [] });
    expect(await screen.findByText("There are no instances yet.")).toBeInTheDocument();
    expect(screen.getByText("No validation schema applies to these instances.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("reports a failure", async () => {
    vi.mocked(fetchStatistics).mockRejectedValue(new Error("Failed to load the statistics (500 )"));
    render(<StatisticsHome />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load the statistics");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("formatShare", () => {
  it.each([
    [0, 100, "0%"],
    [0, 0, "0%"],
    [1, 200, "<1%"],
    [1, 3, "33%"],
    [199, 200, ">99%"],
    [200, 200, "100%"],
  ])("%d of %d is %s", (count, total, expected) => {
    expect(formatShare(count, total)).toBe(expected);
  });
});
