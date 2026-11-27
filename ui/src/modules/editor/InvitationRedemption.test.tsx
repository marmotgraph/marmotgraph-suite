import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HttpError } from "../../services/http";
import InvitationRedemption from "./InvitationRedemption";
import { redeemInvitation } from "../../services/invitations";

vi.mock("../../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});

vi.mock("../../services/invitations", () => ({
  redeemInvitation: vi.fn(),
}));

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="invitations/:token" element={<InvitationRedemption />} />
        <Route path="editor/instances/:instanceId" element={<p>Instance opened</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("InvitationRedemption", () => {
  beforeEach(() => {
    vi.mocked(redeemInvitation).mockReset();
  });

  it("accepts the invitation and opens the instance", async () => {
    vi.mocked(redeemInvitation).mockResolvedValue("instance-1");
    renderAt("/invitations/secret%2Ftoken");

    expect(await screen.findByText("Instance opened")).toBeInTheDocument();
    expect(redeemInvitation).toHaveBeenCalledWith("token", "secret/token");
  });

  it("explains an invitation which can't be accepted", async () => {
    vi.mocked(redeemInvitation).mockImplementation(() =>
      Promise.reject(new HttpError("Failed to accept the invitation (404 Not Found)", 404)),
    );
    renderAt("/invitations/used");

    expect(await screen.findByRole("heading", { level: 1, name: "The invitation could not be accepted" })).toBeInTheDocument();
    expect(screen.getByText("Error 404")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the editor" })).toBeInTheDocument();
    // A used up or expired link is refused - the eagle, not the lost marmot of a page which doesn't exist
    expect(document.querySelector(".layout-not-found-illustration title")).toHaveTextContent("An eagle snatches a marmot");
  });
});
