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
import { fetchReleaseTree, ReleaseNode } from "../services/instances";

vi.mock("../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});

vi.mock("../services/instances", async (importOriginal) => {
  const original = await importOriginal<typeof import("../services/instances")>();
  return { ...original, fetchReleaseTree: vi.fn() };
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
  invitedUsers: [
    { username: "jdoe", scopes: ["parts"] },
    { username: "mmuster", scopes: [] },
  ],
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

function node(instanceId: string, instanceName: string, children: ReleaseNode[] = []): ReleaseNode {
  return {
    instanceId,
    instanceName,
    type: "Device",
    releaseStatus: "released",
    canRelease: false,
    canUnrelease: false,
    children,
  };
}

const PARTS_TREE = node("abc", "Rack", [node("p1", "Power supply")]);
const RACK_TREE = node("abc", "Rack", [node("p1", "Power supply"), node("s1", "Server")]);

describe("InstanceReview", () => {
  beforeEach(() => {
    vi.mocked(fetchReleaseTree)
      .mockReset()
      .mockImplementation((_token, _id, scope) => Promise.resolve(scope === "parts" ? PARTS_TREE : RACK_TREE));
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
    expect(within(within(users).getByText("jdoe").closest("li")!).getByText("parts")).toBeInTheDocument();
    expect(within(within(users).getByText("mmuster").closest("li")!).getByText("This instance only")).toBeInTheDocument();
    const pending = screen.getByRole("region", { name: /Pending invitation links/ });
    expect(within(pending).getByText("For Max")).toBeInTheDocument();
    expect(within(pending).getByText("rack")).toBeInTheDocument();
    expect(fetchInvitations).toHaveBeenCalledWith("token", "abc");
  });

  it("lists the instances covered by the selected scopes", async () => {
    const onInstanceClick = vi.fn();
    render(<InstanceReview instanceId="abc" onInstanceClick={onInstanceClick} />);

    const covered = await screen.findByRole("group", { name: /Instances covered/ });
    expect(await within(covered).findByText("Server")).toBeInTheDocument();
    expect(within(covered).getByText("Power supply")).toBeInTheDocument();
    expect(within(covered).getByText("3")).toBeInTheDocument();
    expect(fetchReleaseTree).toHaveBeenCalledWith("token", "abc", "parts");
    expect(fetchReleaseTree).toHaveBeenCalledWith("token", "abc", "rack");

    fireEvent.click(screen.getByLabelText(/rack/));
    expect(within(covered).queryByText("Server")).not.toBeInTheDocument();
    expect(within(covered).getByText("Power supply")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/parts/));
    expect(within(covered).queryByText("Power supply")).not.toBeInTheDocument();
    expect(within(covered).getByText("Rack")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/parts/));
    fireEvent.click(within(covered).getByRole("button", { name: "Power supply" }));
    expect(onInstanceClick).toHaveBeenCalledWith("p1");
  });

  it("lists the instances an existing invitation covers when expanded", async () => {
    render(<InstanceReview instanceId="abc" />);

    const users = await screen.findByRole("region", { name: /Invited users/ });
    const jdoe = within(users).getByText("jdoe").closest("li")!;
    const toggle = await within(jdoe).findByRole("button", { name: /^Instances covered\s*2$/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(jdoe).queryByText("Power supply")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(jdoe).getByText("Power supply")).toBeInTheDocument();
    expect(within(jdoe).queryByText("Server")).not.toBeInTheDocument();

    const mmuster = within(users).getByText("mmuster").closest("li")!;
    expect(within(mmuster).getByRole("button", { name: /^Instances covered\s*1$/ })).toBeInTheDocument();
    const pending = screen.getByRole("region", { name: /Pending invitation links/ });
    fireEvent.click(within(pending).getByRole("button", { name: /^Instances covered\s*3$/ }));
    expect(within(pending).getByText("Server")).toBeInTheDocument();
    expect(fetchReleaseTree).toHaveBeenCalledTimes(2);
  });

  it("tells how many instances each scope reaches", async () => {
    render(<InstanceReview instanceId="abc" />);

    expect(await screen.findByLabelText(/^parts\s*1 instance$/)).toBeInTheDocument();
    expect(await screen.findByLabelText(/^rack\s*2 instances$/)).toBeInTheDocument();
  });

  it("tells when the type defines no scopes", async () => {
    vi.mocked(fetchInvitations).mockResolvedValue({ ...INVITATIONS, scopes: [] });
    render(<InstanceReview instanceId="abc" />);

    expect(
      await screen.findByText("The type defines no scopes - the invitation applies to this instance only."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Instances covered/ })).not.toBeInTheDocument();
    expect(fetchReleaseTree).not.toHaveBeenCalled();
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

    fireEvent.click(await screen.findByLabelText(/parts/));
    fireEvent.change(screen.getByLabelText("User or invitation label"), { target: { value: "jan" } });
    fireEvent.click(await screen.findByRole("button", { name: "Invite Jane Doe" }));

    expect(await screen.findByText("Jane Doe is invited for review.")).toBeInTheDocument();
    expect(searchInvitationCandidates).toHaveBeenCalledWith("token", "abc", "jan");
    expect(inviteUser).toHaveBeenCalledWith("token", "abc", "user-1", ["rack"]);
    expect(fetchInvitations).toHaveBeenCalledTimes(2);
  });

  it("invites for the instance only if no scope is selected", async () => {
    vi.mocked(createInvitationLink).mockResolvedValue({ id: "inv-2", label: "Ma", scopes: [], token: "secret" });
    render(<InstanceReview instanceId="abc" />);
    fireEvent.click(await screen.findByLabelText(/parts/));
    fireEvent.click(screen.getByLabelText(/rack/));
    expect(screen.getByText("No scope selected - the invitation covers this instance only.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("User or invitation label"), { target: { value: "Ma" } });
    fireEvent.click(screen.getByRole("button", { name: /Create an invitation link labeled Ma/ }));

    await waitFor(() => expect(createInvitationLink).toHaveBeenCalledWith("token", "abc", "Ma", []));
  });

  it("offers an invitation link labeled with the text below the users found", async () => {
    vi.mocked(searchInvitationCandidates).mockResolvedValue([]);
    render(<InstanceReview instanceId="abc" />);

    expect(screen.queryByRole("button", { name: /Create an invitation link/ })).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("User or invitation label"), { target: { value: "Max Muster" } });

    expect(await screen.findByText("No users found.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create an invitation link labeled Max Muster" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Invite / })).not.toBeInTheDocument();
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
