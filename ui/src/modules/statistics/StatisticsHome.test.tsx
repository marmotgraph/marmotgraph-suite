import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import StatisticsHome, { formatShare, VALIDATION_POLL_INTERVAL } from "./StatisticsHome";
import {
  BulkValidationStatus,
  fetchStatistics,
  fetchValidationStatus,
  GraphStatistics,
  ValidationStatistics,
} from "../../services/statistics";

vi.mock("../../contexts/AuthContext", () => {
  // stable like the one of the provider - a new one restarts the loading
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});
vi.mock("../../services/statistics", () => ({ fetchStatistics: vi.fn(), fetchValidationStatus: vi.fn() }));

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
  perType: [
    { identifier: "https://example.org/Language", name: "Language", instances: 150, fullyCompliant: 149, above80Percent: 1, between40And80Percent: 0, below40Percent: 0, notCompliant: 0, notAssessed: 0 },
    { identifier: "https://example.org/Unknown", name: "Unknown", instances: 50, fullyCompliant: 1, above80Percent: 39, between40And80Percent: 9, below40Percent: 1, notCompliant: 0, notAssessed: 0 },
  ],
};

const IDLE: BulkValidationStatus = { state: "IDLE", total: 0, processed: 0 };

function validationStatus(processed: number, state: BulkValidationStatus["state"] = "RUNNING", error?: string): BulkValidationStatus {
  return { state, space: null, startedAt: "2026-11-23T10:15:00Z", total: 200, processed, error };
}

const STATISTICS: GraphStatistics = {
  live: { instances: 84, triples: 449 },
  released: { instances: 64, triples: 404 },
  types: [
    { identifier: "https://example.org/Language", name: "Language", color: "#123456", liveInstances: 27, releasedInstances: 20 },
    { identifier: "https://example.org/Animal", name: "Animal", liveInstances: 13, releasedInstances: 0 },
  ],
  validation: [SCHEMA],
};

/** A promise resolved by the test - e.g. to control when the next poll answers. */
function deferred<T>() {
  let resolve!: (value: T) => Promise<void>;
  const promise = new Promise<T>((r) => {
    resolve = async (value) => {
      r(value);
      await promise;
    };
  });
  return { promise, resolve };
}

function show(statistics: GraphStatistics) {
  vi.mocked(fetchStatistics).mockResolvedValue(statistics);
  render(<StatisticsHome />);
}

/** The value next to a term of a definition list. */
function valueOf(term: HTMLElement) {
  return term.parentElement!.querySelector("dd")!.textContent;
}

describe("StatisticsHome", () => {
  beforeEach(() => {
    vi.mocked(fetchValidationStatus).mockReset().mockResolvedValue(IDLE);
    VALIDATION_POLL_INTERVAL.running = 0;
    VALIDATION_POLL_INTERVAL.idle = 60000;
  });

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
    expect(screen.queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
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
    const bar = screen.getAllByRole("img")[0];
    expect(bar).toHaveAccessibleName(expect.stringContaining("Fully compliant: 150 instances (75%)"));
    // groups without instances don't get a segment
    expect(bar.children).toHaveLength(4);
  });

  it("shows the compliance per type on request", async () => {
    show(STATISTICS);
    const toggle = await screen.findByRole("button", { name: "Show the compliance per type (2)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("img", { name: /^Language:/ })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    const table = screen.getAllByRole("table")[1];
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell").map((c) => c.textContent))).toEqual([
      ["Language", "", "150", "149>99%"],
      ["Unknown", "", "50", "12%"],
    ]);
    expect(within(rows[0]).getByRole("img")).toHaveAccessibleName(expect.stringContaining("Language: Fully compliant: 149 instances"));
    // the color of the type - or the neutral one for a type without statistics
    expect(rows[0].querySelector(".statistics-type-dot")).toHaveStyle({ backgroundColor: "#123456" });
    expect(rows[1].querySelector(".statistics-type-dot")).toHaveStyle({ backgroundColor: "#6c757d" });
    fireEvent.click(screen.getByRole("button", { name: "Hide the compliance per type" }));
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("has no compliance per type without a breakdown", async () => {
    show({ ...STATISTICS, validation: [{ ...SCHEMA, perType: undefined }] });
    await screen.findByRole("heading", { name: "minimal" });
    expect(screen.queryByRole("button", { name: /compliance per type/ })).not.toBeInTheDocument();
  });

  it("shows no progress without a running validation", async () => {
    show(STATISTICS);
    await screen.findByRole("heading", { name: "minimal" });
    expect(fetchValidationStatus).toHaveBeenCalled();
    expect(screen.queryByRole("status", { name: "Validation in progress" })).not.toBeInTheDocument();
  });

  it("shows the progress of a running validation", async () => {
    const next = deferred<BulkValidationStatus>();
    vi.mocked(fetchValidationStatus).mockResolvedValueOnce(validationStatus(50)).mockReturnValueOnce(next.promise)
      .mockReturnValue(new Promise(() => {}));
    show(STATISTICS);
    const progress = await screen.findByRole("status", { name: "Validation in progress" });
    expect(within(progress).getByText("Validating all instances")).toBeInTheDocument();
    expect(within(progress).getByText("50 of 200 instances · 25%")).toBeInTheDocument();
    await act(() => next.resolve(validationStatus(150)));
    expect(within(progress).getByText("150 of 200 instances · 75%")).toBeInTheDocument();
    expect(within(progress).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
    expect(fetchStatistics).toHaveBeenCalledTimes(1);
  });

  it("reloads the statistics once the validation has finished", async () => {
    const next = deferred<BulkValidationStatus>();
    vi.mocked(fetchValidationStatus).mockResolvedValueOnce(validationStatus(50)).mockReturnValueOnce(next.promise)
      .mockReturnValue(new Promise(() => {}));
    vi.mocked(fetchStatistics).mockResolvedValueOnce(STATISTICS).mockResolvedValueOnce({ ...STATISTICS, validation: [] });
    render(<StatisticsHome />);
    expect(await screen.findByRole("status", { name: "Validation in progress" })).toBeInTheDocument();
    await act(() => next.resolve(validationStatus(200, "DONE")));
    expect(await screen.findByText("No validation schema applies to these instances.")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Validation in progress" })).not.toBeInTheDocument();
    expect(fetchStatistics).toHaveBeenCalledTimes(2);
  });

  it("reports a validation which failed while the page was open", async () => {
    const next = deferred<BulkValidationStatus>();
    vi.mocked(fetchValidationStatus).mockResolvedValueOnce({ ...validationStatus(50), space: "common" }).mockReturnValueOnce(next.promise)
      .mockReturnValue(new Promise(() => {}));
    show(STATISTICS);
    expect(await screen.findByText("Validating the instances of common")).toBeInTheDocument();
    await act(() => next.resolve(validationStatus(60, "FAILED", "The core was restarted")));
    expect(await screen.findByText("The validation of the instances failed: The core was restarted")).toBeInTheDocument();
  });

  it("keeps the statistics if the validation status can't be loaded", async () => {
    vi.mocked(fetchValidationStatus).mockRejectedValue(new Error("Failed to load the validation status (403 )"));
    show(STATISTICS);
    expect(await screen.findByRole("heading", { name: "minimal" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
