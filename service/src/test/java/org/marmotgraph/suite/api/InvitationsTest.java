package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Instance;
import org.marmotgraph.sdk.model.InvitationCandidate;
import org.marmotgraph.sdk.model.PendingInvitation;
import org.marmotgraph.sdk.model.ScopeDefinition;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.resources.InstancesResource;
import org.marmotgraph.sdk.resources.ResponseOptions;
import org.marmotgraph.sdk.resources.TypesResource;
import org.marmotgraph.suite.auth.AuthenticatedClientResolver;
import org.marmotgraph.suite.configuration.ArgumentResolvers;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(InvitationsTest.TestConfig.class)
class InvitationsTest {

    @EnableWebMvc
    @Import({Invitations.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
    static class TestConfig {
        @Bean
        MarmotGraphClient marmotGraphClient() {
            return Mockito.mock(MarmotGraphClient.class);
        }
    }

    private static final String DEVICE = "https://example.org/types/Device";
    private static final UUID INSTANCE_ID = UUID.fromString("47b94e45-5435-49a8-aba3-3d482fabced3");
    private static final UUID USER_ID = UUID.fromString("a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d");
    private static final UUID INVITATION_ID = UUID.fromString("0f1e2d3c-4b5a-4968-8776-655443322110");

    @Autowired
    private MarmotGraphClient client;

    private InstancesResource instancesResource;
    private TypesResource typesResource;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client);
        MarmotGraphClient userClient = Mockito.mock(MarmotGraphClient.class);
        instancesResource = Mockito.mock(InstancesResource.class);
        typesResource = Mockito.mock(TypesResource.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        when(userClient.instances()).thenReturn(instancesResource);
        when(userClient.types()).thenReturn(typesResource);
        when(instancesResource.get(INSTANCE_ID, Stage.IN_PROGRESS, ResponseOptions.DEFAULT))
                .thenReturn(new Instance(Map.of("@id", INSTANCE_ID, "@type", DEVICE, "_space", "myspace")));
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    private static PendingInvitation pending(String token) {
        return new PendingInvitation(INVITATION_ID, "For Jane", List.of("parts"), Instant.parse("2026-10-30T10:00:00Z"),
                Instant.parse("2026-11-29T10:00:00Z"), token);
    }

    @Test
    void listProvidesTheScopesInvitedUsersAndPendingInvitations() throws Exception {
        when(instancesResource.listPendingInvitations(INSTANCE_ID)).thenReturn(List.of(pending(null)));
        when(instancesResource.listInvitations(INSTANCE_ID)).thenReturn(List.of("zoe", "adam"));
        when(typesResource.listScopes(DEVICE)).thenReturn(List.of(new ScopeDefinition("parts", null), new ScopeDefinition("rack", null)));

        mockMvc.perform(get("/instances/" + INSTANCE_ID + "/invitations").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scopes[0]").value("parts"))
                .andExpect(jsonPath("$.scopes[1]").value("rack"))
                .andExpect(jsonPath("$.invitedUsers[0]").value("adam"))
                .andExpect(jsonPath("$.invitedUsers[1]").value("zoe"))
                .andExpect(jsonPath("$.pendingInvitations[0].id").value(INVITATION_ID.toString()))
                .andExpect(jsonPath("$.pendingInvitations[0].label").value("For Jane"))
                .andExpect(jsonPath("$.pendingInvitations[0].scopes[0]").value("parts"))
                .andExpect(jsonPath("$.pendingInvitations[0].createdAt").value("2026-10-30T10:00:00Z"))
                .andExpect(jsonPath("$.pendingInvitations[0].expiresAt").value("2026-11-29T10:00:00Z"))
                .andExpect(jsonPath("$.pendingInvitations[0].token").doesNotExist());
    }

    @Test
    void listOmitsWhatTheUserIsNotAllowedToList() throws Exception {
        when(instancesResource.listPendingInvitations(INSTANCE_ID)).thenReturn(List.of());
        when(instancesResource.listInvitations(INSTANCE_ID)).thenThrow(new MarmotGraphApiException(401, "Unauthorized", null, null));
        when(typesResource.listScopes(DEVICE)).thenThrow(new MarmotGraphApiException(403, "Forbidden", null, null));

        mockMvc.perform(get("/instances/" + INSTANCE_ID + "/invitations").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scopes").doesNotExist())
                .andExpect(jsonPath("$.invitedUsers").doesNotExist())
                .andExpect(jsonPath("$.pendingInvitations").isEmpty());
    }

    @Test
    void listForwardsARejectionOfThePendingInvitations() throws Exception {
        when(instancesResource.listPendingInvitations(INSTANCE_ID)).thenThrow(new MarmotGraphApiException(401, "Unauthorized", null, null));

        mockMvc.perform(get("/instances/" + INSTANCE_ID + "/invitations").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isUnauthorized());
        verify(instancesResource, never()).listInvitations(any());
    }

    @Test
    void candidatesFallBackToTheUsername() throws Exception {
        when(instancesResource.searchInvitationCandidates(INSTANCE_ID, "jan")).thenReturn(List.of(
                new InvitationCandidate(USER_ID.toString(), "jane", "Jane Doe"), new InvitationCandidate("other", "janus", null)));

        mockMvc.perform(get("/instances/" + INSTANCE_ID + "/invitationCandidates").param("search", " jan ")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(USER_ID.toString()))
                .andExpect(jsonPath("$[0].name").value("Jane Doe"))
                .andExpect(jsonPath("$[1].name").value("janus"));
    }

    @Test
    void inviteForwardsTheScopes() throws Exception {
        mockMvc.perform(put("/instances/" + INSTANCE_ID + "/invitedUsers/" + USER_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"scopes\": [\"parts\", \"rack\"]}"))
                .andExpect(status().isOk());
        verify(instancesResource).inviteUser(INSTANCE_ID, USER_ID, "parts", "rack");
    }

    @Test
    void inviteWithoutScopesAppliesToAllScopes() throws Exception {
        mockMvc.perform(put("/instances/" + INSTANCE_ID + "/invitedUsers/" + USER_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(instancesResource).inviteUser(INSTANCE_ID, USER_ID);
    }

    @Test
    void revokeLooksUpTheUserByItsUsername() throws Exception {
        when(instancesResource.searchInvitationCandidates(INSTANCE_ID, "jane")).thenReturn(List.of(
                new InvitationCandidate(UUID.randomUUID().toString(), "janet", "Janet"), new InvitationCandidate(USER_ID.toString(), "jane", "Jane Doe")));

        mockMvc.perform(delete("/instances/" + INSTANCE_ID + "/invitedUsers").param("username", "jane")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(instancesResource).revokeInvitation(INSTANCE_ID, USER_ID);
    }

    @Test
    void revokeOfAnUnknownUserIsANoOp() throws Exception {
        when(instancesResource.searchInvitationCandidates(INSTANCE_ID, "ghost")).thenReturn(List.of());

        mockMvc.perform(delete("/instances/" + INSTANCE_ID + "/invitedUsers").param("username", "ghost")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(instancesResource, never()).revokeInvitation(any(), any());
    }

    @Test
    void issueProvidesTheToken() throws Exception {
        when(instancesResource.issueInvitation(INSTANCE_ID, "For Jane", "parts")).thenReturn(pending("theSecret"));

        mockMvc.perform(post("/instances/" + INSTANCE_ID + "/pendingInvitations").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"label\": \" For Jane \", \"scopes\": [\"parts\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("theSecret"))
                .andExpect(jsonPath("$.label").value("For Jane"));
    }

    @Test
    void issueRequiresALabel() throws Exception {
        mockMvc.perform(post("/instances/" + INSTANCE_ID + "/pendingInvitations").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"label\": \"  \"}"))
                .andExpect(status().isBadRequest());
        verify(instancesResource, never()).issueInvitation(any(), anyString(), any(String[].class));
    }

    @Test
    void issueRejectsTooLongLabels() throws Exception {
        String label = "x".repeat(Invitations.MAX_LABEL_LENGTH + 1);
        mockMvc.perform(post("/instances/" + INSTANCE_ID + "/pendingInvitations").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"label\": \"" + label + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void revokeLinkIsForwardedToTheCore() throws Exception {
        mockMvc.perform(delete("/instances/" + INSTANCE_ID + "/pendingInvitations/" + INVITATION_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(instancesResource).revokePendingInvitation(INSTANCE_ID, INVITATION_ID);
    }

    @Test
    void redeemProvidesTheInstance() throws Exception {
        when(instancesResource.redeemInvitation("theSecret")).thenReturn(INSTANCE_ID);

        mockMvc.perform(post("/invitations/redemption").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\": \"theSecret\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instanceId").value(INSTANCE_ID.toString()));
    }

    @Test
    void redeemForwardsAnUnknownToken() throws Exception {
        when(instancesResource.redeemInvitation("used")).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));

        mockMvc.perform(post("/invitations/redemption").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\": \"used\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void redeemRequiresAToken() throws Exception {
        mockMvc.perform(post("/invitations/redemption").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        verify(instancesResource, never()).redeemInvitation(anyString());
    }
}
