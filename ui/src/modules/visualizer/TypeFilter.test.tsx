import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import TypeFilter, { SEARCH_FROM } from "./TypeFilter";
import type { TypeSummary } from "./graphModel";

const make = (count: number): TypeSummary[] => Array.from({ length: count }, (_, i) => ({ type: i === 0 ? "Dataset" : i === 1 ? "DatasetVersion" : `Kind ${i}`, color: "#4f6bed", count: i + 1 }));

/** The filter with the state the panel keeps. */
function Harness({ types, initiallyHidden = [] }: { types: TypeSummary[]; initiallyHidden?: string[] }) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set(initiallyHidden));
  return (
    <TypeFilter
      types={types}
      hidden={hidden}
      onToggle={(type) =>
        setHidden((current) => {
          const next = new Set(current);
          if (!next.delete(type)) next.add(type);
          return next;
        })
      }
      onSetVisible={(names, visible) =>
        setHidden((current) => {
          const next = new Set(current);
          names.forEach((name) => (visible ? next.delete(name) : next.add(name)));
          return next;
        })
      }
    />
  );
}

const master = () => screen.getByLabelText(/^All (types|matching)$/) as HTMLInputElement;
const checkedTypes = () => screen.getAllByRole("checkbox").filter((c) => c !== master()).filter((c) => (c as HTMLInputElement).checked).length;

describe("TypeFilter", () => {
  it("has a checkbox for all types, which is mixed while only some are shown", () => {
    render(<Harness types={make(4)} initiallyHidden={["Kind 2"]} />);
    expect(master().checked).toBe(false);
    expect(master().indeterminate).toBe(true);
    expect(screen.getByText("3 of 4 shown")).toBeInTheDocument();
  });

  it("shows all of them from the mixed state, and hides all from the checked one", () => {
    render(<Harness types={make(4)} initiallyHidden={["Kind 2"]} />);
    fireEvent.click(master());
    expect(checkedTypes()).toBe(4);
    expect(master().checked).toBe(true);
    expect(master().indeterminate).toBe(false);
    fireEvent.click(master());
    expect(checkedTypes()).toBe(0);
    expect(master().checked).toBe(false);
    expect(master().indeterminate).toBe(false);
  });

  it("follows the single checkboxes", () => {
    render(<Harness types={make(3)} />);
    expect(master().checked).toBe(true);
    fireEvent.click(screen.getByLabelText(/Dataset(?!Version)/));
    expect(master().indeterminate).toBe(true);
  });

  it("offers no search for a short list", () => {
    render(<Harness types={make(SEARCH_FROM - 1)} />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("narrows a long list, and the checkbox then applies to what matches", () => {
    render(<Harness types={make(20)} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "dataset" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(3); // the two matches and the checkbox for them
    expect(master()).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("All matching"));
    // Only the matches are hidden - the other 18 are untouched
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(checkedTypes()).toBe(18);
    expect(master().indeterminate).toBe(true);
  });

  it("says so when nothing matches, and leaves the checkbox out of play", () => {
    render(<Harness types={make(20)} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByRole("status")).toHaveTextContent("No type matches");
    expect(screen.getByLabelText("All matching")).toBeDisabled();
  });

  it("clears the search with Escape", () => {
    render(<Harness types={make(20)} />);
    const search = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "kind" } });
    fireEvent.keyDown(search, { key: "Escape" });
    expect(search.value).toBe("");
  });

  it("says when there is nothing yet", () => {
    render(<Harness types={[]} />);
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });
});
