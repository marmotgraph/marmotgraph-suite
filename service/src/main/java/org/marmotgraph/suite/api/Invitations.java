package org.marmotgraph.suite.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.InvitationCandidate;
import org.marmotgraph.sdk.model.PendingInvitation;
import org.marmotgraph.sdk.model.ScopeDefinition;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.resources.ResponseOptions;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Manages the invitations to review an instance - of known users (who have logged in before) and by invitation links
 * (for users who haven't logged in yet) - and redeems the invitation links. Forwarded to the MarmotGraph core on behalf
 * of the user who issued the request.
 */
@RestController
public class Invitations {

    /** The longest label the core accepts for an invitation link */
    static final int MAX_LABEL_LENGTH = 255;

    /**
     * An invitation link which hasn't been redeemed yet - the token is only provided when the invitation is issued
     * (it can't be retrieved again). The timestamps are ISO-8601.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record InvitationLink(String id, String label, List<String> scopes, String createdAt, String expiresAt, String token) {

        static InvitationLink of(PendingInvitation invitation) {
            return new InvitationLink(Objects.toString(invitation.id(), null), invitation.label(), invitation.scopes(),
                    isoString(invitation.createdAt()), isoString(invitation.expiresAt()), invitation.token());
        }
    }

    /**
     * The invitations of an instance. The scopes are the names of the scopes defined for its type - null if the user
     * isn't allowed to list them. The invitedUsers are the usernames of the users invited - null if the user isn't
     * allowed to list them.
     */
    public record InstanceInvitations(List<String> scopes, List<String> invitedUsers, List<InvitationLink> pendingInvitations) {
    }

    /** A known user who can be invited - the name falls back to the username if it is not known. */
    public record Candidate(String id, String username, String name) {

        static Candidate of(InvitationCandidate candidate) {
            return new Candidate(candidate.id(), candidate.username(),
                    candidate.name() != null && !candidate.name().isBlank() ? candidate.name() : candidate.username());
        }
    }

    /**
     * The scopes of the type of the instance an invitation applies to (by their name) - all of them if none are
     * given.
     */
    public record InvitationScopes(List<String> scopes) {
    }

    /** The label (mandatory) and the scopes of a new invitation link. */
    public record NewInvitationLink(String label, List<String> scopes) {
    }

    public record Redemption(String token) {
    }

    /** The instance an invitation was redeemed for. */
    public record RedeemedInvitation(String instanceId) {
    }

    /**
     * The invitations of the instance: the invited users and the invitation links which haven't been redeemed yet - and
     * the scopes an invitation can be restricted to. Listing the invited users requires the global functionality
     * LIST_INVITATIONS, listing the scopes DEFINE_SCOPES - both are omitted (null) if the user lacks them.
     *
     * @param id the uuid of the instance as known by the core
     */
    @GetMapping("/instances/{id}/invitations")
    public InstanceInvitations list(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        // Requires the permission to invite for the instance - its failures are forwarded. Since it succeeded, the
        // token is valid: a 401 of the following requests stems from a missing functionality.
        List<InvitationLink> pending = client.instances().listPendingInvitations(id).stream().map(InvitationLink::of).toList();
        List<String> invitedUsers = unlessUnauthorized(() -> client.instances().listInvitations(id).stream().sorted(String.CASE_INSENSITIVE_ORDER).toList());
        String type = client.instances().get(id, Stage.IN_PROGRESS, ResponseOptions.DEFAULT).getType();
        List<String> scopes = type == null ? List.of()
                : unlessUnauthorized(() -> client.types().listScopes(type).stream().map(ScopeDefinition::name).toList());
        return new InstanceInvitations(scopes, invitedUsers, pending);
    }

    /**
     * The known users matching the search - by their email address (exactly) or a part of their username or name (at
     * least 3 characters).
     *
     * @param id the uuid of the instance as known by the core
     */
    @GetMapping("/instances/{id}/invitationCandidates")
    public List<Candidate> candidates(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id, @RequestParam String search) {
        return client.instances().searchInvitationCandidates(id, search.trim()).stream().map(Candidate::of).toList();
    }

    /**
     * Invites the known user to review the instance and the instances in the given scopes of its type - replaces the
     * scopes of an existing invitation of the user.
     *
     * @param id     the uuid of the instance as known by the core
     * @param userId the id of the user as provided by {@link #candidates}
     */
    @PutMapping("/instances/{id}/invitedUsers/{userId}")
    public void invite(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id, @PathVariable UUID userId,
                       @RequestBody(required = false) InvitationScopes scopes) {
        client.instances().inviteUser(id, userId, scopeNames(scopes != null ? scopes.scopes() : null));
    }

    /**
     * Revokes the invitation of the user with the given username - the core lists the invited users by their username
     * only, which is why its id is looked up among the candidates. A no-op if the user is not known.
     *
     * @param id the uuid of the instance as known by the core
     */
    @DeleteMapping("/instances/{id}/invitedUsers")
    public void revoke(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id, @RequestParam String username) {
        client.instances().searchInvitationCandidates(id, username).stream()
                .filter(c -> username.equals(c.username()) && c.id() != null)
                .findFirst()
                .ifPresent(c -> client.instances().revokeInvitation(id, UUID.fromString(c.id())));
    }

    /**
     * Issues an invitation link for the instance - the label is mandatory (it tells whom the link was given to). The
     * returned token is only provided once.
     *
     * @param id the uuid of the instance as known by the core
     */
    @PostMapping("/instances/{id}/pendingInvitations")
    public InvitationLink issue(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id,
                                @RequestBody NewInvitationLink invitation) {
        String label = invitation.label() != null ? invitation.label().trim() : "";
        if (label.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The label of the invitation is missing");
        }
        if (label.length() > MAX_LABEL_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.format("The label of the invitation exceeds %d characters", MAX_LABEL_LENGTH));
        }
        return InvitationLink.of(client.instances().issueInvitation(id, label, scopeNames(invitation.scopes())));
    }

    /**
     * Revokes an invitation link which hasn't been redeemed yet - a no-op if it doesn't exist (anymore).
     *
     * @param id the uuid of the instance as known by the core
     */
    @DeleteMapping("/instances/{id}/pendingInvitations/{invitationId}")
    public void revokeLink(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id, @PathVariable UUID invitationId) {
        client.instances().revokePendingInvitation(id, invitationId);
    }

    /**
     * Redeems an invitation link for the current user - the core responds with 404 if the token is unknown, already
     * redeemed or expired.
     */
    @PostMapping("/invitations/redemption")
    public RedeemedInvitation redeem(@AuthenticatedClient MarmotGraphClient client, @RequestBody Redemption redemption) {
        if (redemption.token() == null || redemption.token().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The token of the invitation is missing");
        }
        return new RedeemedInvitation(client.instances().redeemInvitation(redemption.token().trim()).toString());
    }

    private static String[] scopeNames(List<String> scopes) {
        return scopes == null ? new String[0] : scopes.stream().filter(s -> s != null && !s.isBlank()).distinct().toArray(String[]::new);
    }

    /** The result - or null if the core rejects the request since the user lacks the functionality for it. */
    private static <T> T unlessUnauthorized(Supplier<T> request) {
        try {
            return request.get();
        } catch (MarmotGraphApiException e) {
            if (e.statusCode() == HttpStatus.UNAUTHORIZED.value() || e.statusCode() == HttpStatus.FORBIDDEN.value()) {
                return null;
            }
            throw e;
        }
    }

    private static String isoString(Instant instant) {
        return instant != null ? instant.toString() : null;
    }
}
