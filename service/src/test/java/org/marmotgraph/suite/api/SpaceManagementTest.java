package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.SpaceInformation;
import org.marmotgraph.sdk.model.SpaceSpecification;
import org.marmotgraph.sdk.model.SpaceTypeInformation;
import org.marmotgraph.sdk.model.TypeInSpace;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.sdk.pagination.Page;
import org.marmotgraph.sdk.resources.SpaceListOptions;
import org.marmotgraph.sdk.resources.SpacesResource;
import org.marmotgraph.sdk.resources.TypeListOptions;
import org.marmotgraph.sdk.resources.TypesResource;
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
import java.util.Optional;
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

@SpringJUnitWebConfig(SpaceManagementTest.TestConfig.class)
class SpaceManagementTest {

    @EnableWebMvc
    @Import({SpaceManagement.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
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

    private static final String DEVICE = "https://example.org/types/Device";
    private static final String ROOM = "https://example.org/types/Room";
    private static final String BUILDING = "https://example.org/types/Building";

    private SpacesResource spaces;
    private TypesResource types;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client, cache);
        MarmotGraphClient userClient = Mockito.mock(MarmotGraphClient.class);
        spaces = Mockito.mock(SpacesResource.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        types = Mockito.mock(TypesResource.class);
        when(userClient.spaces()).thenReturn(spaces);
        when(userClient.types()).thenReturn(types);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    @SuppressWarnings("unchecked")
    void listProvidesTheManageableSpacesOnly() throws Exception {
        Page<SpaceInformation> page = Mockito.mock(Page.class);
        when(page.allItems()).thenReturn(Stream.of(
                new SpaceInformation("restricted", "restricted", List.of("READ")),
                new SpaceInformation("managed", "Managed space", List.of("READ", "MANAGE_SPACE")),
                new SpaceInformation("another", "another", List.of("MANAGE_SPACE")),
                new SpaceInformation("unknown", "unknown", null),
                new SpaceInformation("myspace", "myspace", List.of("MANAGE_SPACE")),
                new SpaceInformation("review", "review", List.of("MANAGE_SPACE"))));
        when(spaces.list(any(SpaceListOptions.class))).thenReturn(page);

        mockMvc.perform(get("/admin/spaces").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].identifier").value("another"))
                .andExpect(jsonPath("$[1].identifier").value("managed"))
                .andExpect(jsonPath("$[1].name").value("Managed space"));
        verify(spaces, never()).getSpecification(any());
    }

    @Test
    void getProvidesTheSpecificationOfTheSpace() throws Exception {
        when(spaces.getSpecification("managed")).thenReturn(new SpaceSpecification("managed", "managed", true, false, null, true));
        when(spaces.getSpecification("unspecified")).thenReturn(new SpaceSpecification("unspecified", "unspecified", false, false, false, false));

        mockMvc.perform(get("/admin/spaces/managed").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identifier").value("managed"))
                .andExpect(jsonPath("$.settings.autoRelease").value(true))
                .andExpect(jsonPath("$.settings.clientSpace").value(false))
                .andExpect(jsonPath("$.settings.deferCache").value(false))
                .andExpect(jsonPath("$.specified").value(true));
        mockMvc.perform(get("/admin/spaces/unspecified").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.specified").value(false));
    }

    @Test
    @SuppressWarnings("unchecked")
    void typesAreProvidedWithTheirAssignmentAndOccurrencesInTheSpace() throws Exception {
        Page<TypeInformation> page = Mockito.mock(Page.class);
        when(page.allItems()).thenReturn(Stream.of(
                new TypeInformation(ROOM, null, "Room", "#00ff00", null, false, 3, null, null,
                        List.of(new SpaceTypeInformation("other", 3, null))),
                new TypeInformation(DEVICE, null, "device", "#ff0000", null, false, 12, null, null,
                        List.of(new SpaceTypeInformation("myproject", 10, null), new SpaceTypeInformation("other", 2, null))),
                new TypeInformation(BUILDING, null, null, null, null, false, 0, null, null, null)));
        when(types.list(any(TypeListOptions.class))).thenReturn(page);
        when(spaces.getType("myproject", DEVICE)).thenReturn(Optional.of(new TypeInSpace("myproject", DEVICE)));
        when(spaces.getType("myproject", ROOM)).thenReturn(Optional.empty());
        // The core reports a type which is not part of the space as not found
        when(spaces.getType("myproject", BUILDING)).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));

        mockMvc.perform(get("/admin/spaces/myproject/types").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].identifier").value(DEVICE))
                .andExpect(jsonPath("$[0].color").value("#ff0000"))
                .andExpect(jsonPath("$[0].assigned").value(true))
                .andExpect(jsonPath("$[0].occurrences").value(10))
                .andExpect(jsonPath("$[1].identifier").value(BUILDING))
                .andExpect(jsonPath("$[1].assigned").value(false))
                .andExpect(jsonPath("$[1].occurrences").value(0))
                .andExpect(jsonPath("$[2].identifier").value(ROOM))
                .andExpect(jsonPath("$[2].assigned").value(false))
                .andExpect(jsonPath("$[2].occurrences").value(0));
    }

    @Test
    void typeIsAssignedToAndRemovedFromTheSpace() throws Exception {
        mockMvc.perform(put("/admin/spaces/myproject/types").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(spaces).assignType("myproject", DEVICE);

        mockMvc.perform(delete("/admin/spaces/myproject/types").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(spaces).removeType("myproject", DEVICE);
    }

    @Test
    void removingATypeWhichIsNotPartOfTheSpaceSucceeds() throws Exception {
        doThrow(new MarmotGraphApiException(404, "Not found", null, null)).when(spaces).removeType("myproject", DEVICE);

        mockMvc.perform(delete("/admin/spaces/myproject/types").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
    }

    @Test
    void typesOfInvalidSpacesAreRejected() throws Exception {
        mockMvc.perform(put("/admin/spaces/{space}/types", "my space").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/admin/spaces/myproject/types").param("type", " ").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(spaces);
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
