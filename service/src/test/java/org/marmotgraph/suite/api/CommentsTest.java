package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Comment;
import org.marmotgraph.sdk.resources.InstancesResource;
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
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(CommentsTest.TestConfig.class)
class CommentsTest {

    @EnableWebMvc
    @Import({Comments.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
    static class TestConfig {
        @Bean
        MarmotGraphClient marmotGraphClient() {
            return Mockito.mock(MarmotGraphClient.class);
        }
    }

    private static final UUID INSTANCE_ID = UUID.fromString("47b94e45-5435-49a8-aba3-3d482fabced3");
    private static final UUID COMMENT_ID = UUID.fromString("a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d");
    private static final String NAME = "http://schema.org/name";
    private static final Instant CREATED = Instant.parse("2026-11-02T10:00:00Z");
    private static final Instant UPDATED = Instant.parse("2026-11-02T11:00:00Z");

    @Autowired
    private MarmotGraphClient client;

    private InstancesResource instancesResource;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client);
        MarmotGraphClient userClient = Mockito.mock(MarmotGraphClient.class);
        instancesResource = Mockito.mock(InstancesResource.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        when(userClient.instances()).thenReturn(instancesResource);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void listProvidesTheCommentsWithTheirAuthors() throws Exception {
        when(instancesResource.listComments(INSTANCE_ID)).thenReturn(List.of(
                new Comment(COMMENT_ID, NAME, "Is this right?", CREATED, UPDATED, true, new Comment.Author("jdoe", "Jane Doe")),
                new Comment(UUID.randomUUID(), null, "Looks good", CREATED, null, false, new Comment.Author("nameless", " ")),
                new Comment(UUID.randomUUID(), null, "Anonymous", CREATED, null, false, null)));

        mockMvc.perform(get("/instances/{id}/comments", INSTANCE_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(COMMENT_ID.toString()))
                .andExpect(jsonPath("$[0].property").value(NAME))
                .andExpect(jsonPath("$[0].text").value("Is this right?"))
                .andExpect(jsonPath("$[0].createdAt").value("2026-11-02T10:00:00Z"))
                .andExpect(jsonPath("$[0].updatedAt").value("2026-11-02T11:00:00Z"))
                .andExpect(jsonPath("$[0].own").value(true))
                .andExpect(jsonPath("$[0].createdBy.name").value("Jane Doe"))
                .andExpect(jsonPath("$[1].property").doesNotExist())
                .andExpect(jsonPath("$[1].updatedAt").doesNotExist())
                .andExpect(jsonPath("$[1].own").value(false))
                .andExpect(jsonPath("$[1].createdBy.name").value("nameless"))
                .andExpect(jsonPath("$[2].createdBy").doesNotExist());
    }

    @Test
    void addForwardsThePropertyAndTheText() throws Exception {
        when(instancesResource.addComment(INSTANCE_ID, NAME, "Is this right?"))
                .thenReturn(new Comment(COMMENT_ID, NAME, "Is this right?", CREATED, null, true, new Comment.Author("jdoe", "Jane Doe")));

        mockMvc.perform(post("/instances/{id}/comments", INSTANCE_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"property\": \"" + NAME + "\", \"text\": \"Is this right?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(COMMENT_ID.toString()))
                .andExpect(jsonPath("$.property").value(NAME));
    }

    @Test
    void addWithoutPropertyCommentsOnTheInstance() throws Exception {
        when(instancesResource.addComment(INSTANCE_ID, null, "Looks good"))
                .thenReturn(new Comment(COMMENT_ID, null, "Looks good", CREATED, null, true, null));

        mockMvc.perform(post("/instances/{id}/comments", INSTANCE_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"text\": \"Looks good\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.property").doesNotExist());
    }

    @Test
    void rejectsACommentWithoutText() throws Exception {
        mockMvc.perform(post("/instances/{id}/comments", INSTANCE_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"text\": \"  \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/instances/{id}/comments/{commentId}", INSTANCE_ID, COMMENT_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(instancesResource);
    }

    @Test
    void updateReplacesTheText() throws Exception {
        when(instancesResource.updateComment(INSTANCE_ID, COMMENT_ID, "Changed"))
                .thenReturn(new Comment(COMMENT_ID, null, "Changed", CREATED, UPDATED, true, null));

        mockMvc.perform(put("/instances/{id}/comments/{commentId}", INSTANCE_ID, COMMENT_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"text\": \"Changed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value("Changed"))
                .andExpect(jsonPath("$.updatedAt").value("2026-11-02T11:00:00Z"));
    }

    @Test
    void deleteRemovesTheComment() throws Exception {
        mockMvc.perform(delete("/instances/{id}/comments/{commentId}", INSTANCE_ID, COMMENT_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());

        verify(instancesResource).deleteComment(INSTANCE_ID, COMMENT_ID);
    }

    @Test
    void reportsTheRejectionOfTheCore() throws Exception {
        when(instancesResource.listComments(any())).thenThrow(new MarmotGraphApiException(403, "Forbidden", null, null));

        mockMvc.perform(get("/instances/{id}/comments", INSTANCE_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isForbidden());
    }
}
