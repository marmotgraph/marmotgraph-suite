import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FavoriteButton from "./FavoriteButton";

describe("FavoriteButton", () => {
  it("offers to add an instance which is no favorite", () => {
    const onToggle = vi.fn();
    render(<FavoriteButton favorite={false} instanceName="Headquarters" onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: "Add Headquarters to favorites" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows a favorite as pressed and offers to remove it", () => {
    render(<FavoriteButton favorite instanceName="Headquarters" onToggle={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Remove Headquarters from favorites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
