package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.SpaceInformation;
import org.marmotgraph.sdk.model.SpaceSpecification;
import org.marmotgraph.sdk.pagination.Page;
import org.marmotgraph.sdk.resources.SpaceListOptions;
import org.marmotgraph.sdk.resources.SpacesResource;
import org.marmotgraph.suite.auth.AuthenticatedClientResolver;
import org.marmotgraph.suite.configuration.ArgumentResolvers;
import org.marmotgraph.suite.spaces.SpaceCache;
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
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(SpaceSpecificationsTest.TestConfig.class)
class SpaceSpecificationsTest {

    @EnableWebMvc
    @Import({SpaceSpecifications.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
    static class TestConfig {
        @Bean
        MarmotGraphClient marmotGraphClient() {
            return Mockito.mock(MarmotGraphClient.class);
        }

        @Bean
        SpaceCache spaceCache() {
            return Mockito.mock(SpaceCache.class);
        }
    }

    @Autowired
    private MarmotGraphClient client;

    @Autowired
    private SpaceCache cache;

    private SpacesResource spaces;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client, cache);
        MarmotGraphClient userClient = Mockito.mock(MarmotGraphClient.class);
        spaces = Mockito.mock(SpacesResource.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        when(userClient.spaces()).thenReturn(spaces);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    @SuppressWarnings("unchecked")
    void listProvidesTheSettingsOfManageableSpacesOnly() throws Exception {
        Page<SpaceInformation> page = Mockito.mock(Page.class);
        when(page.allItems()).thenReturn(Stream.of(
                new SpaceInformation("restricted", "restricted", List.of("READ")),
                new SpaceInformation("managed", "managed", List.of("READ", "MANAGE_SPACE")),
                new SpaceInformation("unspecified", "unspecified", List.of("MANAGE_SPACE")),
                new SpaceInformation("myspace", "myspace", List.of("MANAGE_SPACE")),
                new SpaceInformation("review", "review", List.of("MANAGE_SPACE"))));
        when(spaces.list(any(SpaceListOptions.class))).thenReturn(page);
        when(spaces.getSpecification("managed")).thenReturn(new SpaceSpecification("managed", "managed", true, false, null, true));
        when(spaces.getSpecification("unspecified")).thenReturn(new SpaceSpecification("unspecified", "unspecified", false, false, false, false));

        mockMvc.perform(get("/admin/spaces").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].identifier").value("managed"))
                .andExpect(jsonPath("$[0].settings.autoRelease").value(true))
                .andExpect(jsonPath("$[0].settings.clientSpace").value(false))
                .andExpect(jsonPath("$[0].settings.deferCache").value(false))
                .andExpect(jsonPath("$[0].specified").value(true))
                .andExpect(jsonPath("$[1].identifier").value("restricted"))
                .andExpect(jsonPath("$[1].settings").doesNotExist())
                .andExpect(jsonPath("$[1].specified").value(false))
                .andExpect(jsonPath("$[2].identifier").value("unspecified"))
                .andExpect(jsonPath("$[2].settings.autoRelease").value(false))
                .andExpect(jsonPath("$[2].specified").value(false));
        verify(spaces, never()).getSpecification("restricted");
    }

    @Test
    void putSpecifiesTheSpaceAndDropsItFromTheCache() throws Exception {
        mockMvc.perform(put("/admin/spaces/my.space").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"autoRelease\": true, \"clientSpace\": false, \"deferCache\": true}"))
                .andExpect(status().isOk());

        verify(spaces).createOrUpdateSpecification("my.space", new SpaceSpecification(null, null, true, false, true));
        verify(cache).invalidate("my.space");
    }

    @Test
    void deleteRemovesTheSpecificationAndDropsItFromTheCache() throws Exception {
        mockMvc.perform(delete("/admin/spaces/myproject").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());

        verify(spaces).deleteSpecification("myproject");
        verify(cache).invalidate("myproject");
    }

    @Test
    void reservedSpacesAndInvalidNamesAreRejected() throws Exception {
        for (String space : List.of("myspace", "review", "in valid")) {
            mockMvc.perform(delete("/admin/spaces/{space}", space).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                    .andExpect(status().isBadRequest());
            mockMvc.perform(put("/admin/spaces/{space}", space).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"autoRelease\": true, \"clientSpace\": false, \"deferCache\": false}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(result -> assertInstanceOf(ResponseStatusException.class, result.getResolvedException()));
        }
        verifyNoInteractions(spaces);
    }

    @Test
    void errorsOfTheCoreAreForwardedAndKeepTheCache() throws Exception {
        doThrow(new MarmotGraphApiException(403, "Forbidden", null, null)).when(spaces).deleteSpecification("myproject");

        mockMvc.perform(delete("/admin/spaces/myproject").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Forbidden"));
        verify(cache, never()).invalidate("myproject");
    }

}
