import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import InstanceReview from "./InstanceReview";
import {
  createInvitationLink,
  fetchInvitations,
  inviteUser,
  revokeInvitationLink,
  revokeUserInvitation,
  searchInvitationCandidates,
} from "../services/invitations";

vi.mock("../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});

vi.mock("../services/invitations", async (importOriginal) => {
  const original = await importOriginal<typeof import("../services/invitations")>();
  return {
    ...original,
    fetchInvitations: vi.fn(),
    searchInvitationCandidates: vi.fn(),
    inviteUser: vi.fn(),
    revokeUserInvitation: vi.fn(),
    createInvitationLink: vi.fn(),
    revokeInvitationLink: vi.fn(),
  };
});

const INVITATIONS = {
  scopes: ["parts", "rack"],
  invitedUsers: ["jdoe"],
  pendingInvitations: [
    {
      id: "inv-1",
      label: "For Max",
      scopes: ["rack"],
      createdAt: "2026-10-30T10:00:00Z",
      expiresAt: "2026-11-29T10:00:00Z",
    },
  ],
};

describe("InstanceReview", () => {
  beforeEach(() => {
    vi.mocked(fetchInvitations).mockReset().mockResolvedValue(INVITATIONS);
    vi.mocked(searchInvitationCandidates).mockReset();
    vi.mocked(inviteUser).mockReset().mockResolvedValue(undefined);
    vi.mocked(revokeUserInvitation).mockReset().mockResolvedValue(undefined);
    vi.mocked(createInvitationLink).mockReset();
    vi.mocked(revokeInvitationLink).mockReset().mockResolvedValue(undefined);
  });

  it("lists the invited users and the pending invitation links with their scopes", async () => {
    render(<InstanceReview instanceId="abc" />);

    const users = await screen.findByRole("region", { name: /Invited users/ });
    expect(within(users).getByText("jdoe")).toBeInTheDocument();
    const pending = screen.getByRole("region", { name: /Pending invitation links/ });
    expect(within(pending).getByText("For Max")).toBeInTheDocument();
    expect(within(pending).getByText("rack")).toBeInTheDocument();
    expect(fetchInvitations).toHaveBeenCalledWith("token", "abc");
  });

  it("tells when the invited users can't be listed", async () => {
    vi.mocked(fetchInvitations).mockResolvedValue({ ...INVITATIONS, invitedUsers: undefined, pendingInvitations: [] });
    render(<InstanceReview instanceId="abc" />);

    expect(await screen.findByText("You aren't allowed to list the invited users.")).toBeInTheDocument();
    expect(screen.getByText("No pending invitation links.")).toBeInTheDocument();
  });

  it("invites a user found by the search with the selected scopes", async () => {
    vi.mocked(searchInvitationCandidates).mockResolvedValue([
      { id: "user-1", username: "jane", name: "Jane Doe" },
    ]);
    render(<InstanceReview instanceId="abc" />);

    fireEvent.change(await screen.findByLabelText("User or invitation label"), { target: { value: "jan" } });
    fireEvent.click(await screen.findByRole("button", { name: /Jane Doe/ }));
    fireEvent.click(screen.getByLabelText("parts"));
    fireEvent.click(screen.getByRole("button", { name: "Invite user" }));

    expect(await screen.findByText("Jane Doe is invited for review.")).toBeInTheDocument();
    expect(searchInvitationCandidates).toHaveBeenCalledWith("token", "abc", "jan");
    expect(inviteUser).toHaveBeenCalledWith("token", "abc", "user-1", ["rack"]);
    expect(fetchInvitations).toHaveBeenCalledTimes(2);
  });

  it("requires at least one scope", async () => {
    render(<InstanceReview instanceId="abc" />);
    fireEvent.change(await screen.findByLabelText("User or invitation label"), { target: { value: "Ma" } });
    fireEvent.click(screen.getByRole("button", { name: /Create an invitation link labeled Ma/ }));
    fireEvent.click(screen.getByLabelText("parts"));
    fireEvent.click(screen.getByLabelText("rack"));

    expect(screen.getByRole("alert")).toHaveTextContent("Select at least one scope.");
    expect(screen.getByRole("button", { name: "Create invitation link" })).toBeDisabled();
  });

  it("offers an invitation link labeled with the text below the users found", async () => {
    vi.mocked(searchInvitationCandidates).mockResolvedValue([]);
    render(<InstanceReview instanceId="abc" />);

    expect(screen.queryByRole("button", { name: /Create an invitation link/ })).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("User or invitation label"), { target: { value: "Max Muster" } });

    expect(await screen.findByText("No users found.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create an invitation link labeled Max Muster" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite user" })).toBeDisabled();
  });

  it("creates an invitation link labeled with the text and offers it to be copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.mocked(createInvitationLink).mockResolvedValue({
      id: "inv-2",
      label: "For Max",
      scopes: ["parts", "rack"],
      token: "secret/token",
    });
    render(<InstanceReview instanceId="abc" />);

    fireEvent.change(await screen.findByLabelText("User or invitation label"), { target: { value: "  For Max " } });
    fireEvent.click(screen.getByRole("button", { name: /Create an invitation link labeled For Max/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create invitation link" }));

    const link = await screen.findByLabelText("Invitation link", { selector: "input[readonly]" });
    expect(link).toHaveValue(`${window.location.origin}/invitations/secret%2Ftoken`);
    expect(createInvitationLink).toHaveBeenCalledWith("token", "abc", "For Max", ["parts", "rack"]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invitations/secret%2Ftoken`);
  });

  it("removes an invitation link after confirmation", async () => {
    render(<InstanceReview instanceId="abc" />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove the invitation link For Max" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("For Max")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove invitation" }));

    await waitFor(() => expect(revokeInvitationLink).toHaveBeenCalledWith("token", "abc", "inv-1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("removes the invitation of a user after confirmation", async () => {
    render(<InstanceReview instanceId="abc" />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove the invitation of jdoe" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove invitation" }));

    await waitFor(() => expect(revokeUserInvitation).toHaveBeenCalledWith("token", "abc", "jdoe"));
  });
});
