package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Instance;
import org.marmotgraph.sdk.model.ReleaseStatus;
import org.marmotgraph.sdk.model.ReleaseTreeScope;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.sdk.pagination.Page;
import org.marmotgraph.sdk.resources.InstanceListOptions;
import org.marmotgraph.sdk.resources.InstancesResource;
import org.marmotgraph.sdk.resources.TypesResource;
import org.marmotgraph.suite.auth.AuthenticatedClientResolver;
import org.marmotgraph.suite.configuration.ArgumentResolvers;
import org.marmotgraph.suite.configuration.Variables;
import org.marmotgraph.suite.types.TypeCache;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(InstancesTest.TestConfig.class)
class InstancesTest {

    @EnableWebMvc
    @Import({Instances.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
    static class TestConfig {
        @Bean
        MarmotGraphClient marmotGraphClient() {
            return Mockito.mock(MarmotGraphClient.class);
        }

        @Bean
        TypeCache typeCache() {
            Variables variables = Mockito.mock(Variables.class);
            when(variables.typeCacheTtl()).thenReturn(300);
            return new TypeCache(variables);
        }
    }

    private static final String DEVICE = "https://example.org/types/Device";
    private static final String NAME = "http://schema.org/name";
    private static final UUID RELEASED_ID = UUID.fromString("47b94e45-5435-49a8-aba3-3d482fabced3");
    private static final UUID UNRELEASED_ID = UUID.fromString("a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d");

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
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    private static Instance instance(UUID id, String type, Map<String, Object> properties) {
        Instance instance = new Instance(Map.of("@id", "https://kg.ebrains.eu/api/instances/" + id, "@type", List.of(type),
                Instances.SPACE, "myspace"));
        instance.putAll(properties);
        return instance;
    }

    private static Page<Instance> page(List<Instance> items) {
        return new Page<>(items, items.size(), 50, 0, null, null, Map.of(), null);
    }

    @Test
    void listMapsTheInstancesOfTheCore() throws Exception {
        when(instancesResource.list(any(InstanceListOptions.class))).thenReturn(page(List.of(
                instance(RELEASED_ID, DEVICE, Map.of(NAME, "Server-Rack-A1", Instances.PERMISSIONS, List.of("RELEASE", "READ", "WRITE", "DELETE"))),
                instance(UNRELEASED_ID, "https://example.org/types/Unknown", Map.of(Instances.PERMISSIONS, List.of("READ")))
        )));
        when(typesResource.getByNames(List.of(DEVICE, "https://example.org/types/Unknown"), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(DEVICE, new TypeInformation(DEVICE, "A device in the data center", "Device", "#ff9800", NAME, null, null, List.of(), List.of(), List.of(), Map.of())));
        when(instancesResource.releaseStatusByIds(List.of(RELEASED_ID, UNRELEASED_ID), ReleaseTreeScope.TOP_INSTANCE_ONLY))
                .thenReturn(Map.of(RELEASED_ID.toString(), ReleaseStatus.RELEASED, UNRELEASED_ID.toString(), ReleaseStatus.HAS_CHANGED));

        mockMvc.perform(get("/instances").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].instanceId").value(RELEASED_ID.toString()))
                .andExpect(jsonPath("$[0].type").value("Device"))
                .andExpect(jsonPath("$[0].typeDescription").value("A device in the data center"))
                .andExpect(jsonPath("$[0].typeColor").value("#ff9800"))
                .andExpect(jsonPath("$[0].instanceName").value("Server-Rack-A1"))
                .andExpect(jsonPath("$[0].space").value("myspace"))
                .andExpect(jsonPath("$[0].permissions").value("View, Edit, Release"))
                .andExpect(jsonPath("$[0].bookmarked").value(false))
                .andExpect(jsonPath("$[0].lastVisited").doesNotExist())
                .andExpect(jsonPath("$[0].releaseStatus").value("released"))
                .andExpect(jsonPath("$[1].type").value("Unknown"))
                .andExpect(jsonPath("$[1].typeDescription").doesNotExist())
                .andExpect(jsonPath("$[1].typeColor").doesNotExist())
                .andExpect(jsonPath("$[1].instanceName").value(UNRELEASED_ID.toString()))
                .andExpect(jsonPath("$[1].permissions").value("View"))
                .andExpect(jsonPath("$[1].releaseStatus").value("in progress"));

        ArgumentCaptor<InstanceListOptions> options = ArgumentCaptor.forClass(InstanceListOptions.class);
        verify(instancesResource).list(options.capture());
        assertEquals(Stage.IN_PROGRESS, options.getValue().stage());
        assertTrue(options.getValue().responseOptions().returnPermissions());
        assertNull(options.getValue().searchByLabel());
        assertEquals(List.of(), options.getValue().types());
        assertEquals(List.of(), options.getValue().spaces());
    }

    @Test
    void listForwardsTheTypeAndSpaceFiltersToTheCore() throws Exception {
        when(instancesResource.list(any(InstanceListOptions.class))).thenReturn(page(List.of()));

        mockMvc.perform(get("/instances").param("type", DEVICE, "https://example.org/types/Building", " ")
                        .param("space", "myspace", "otherspace").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());

        ArgumentCaptor<InstanceListOptions> options = ArgumentCaptor.forClass(InstanceListOptions.class);
        verify(instancesResource).list(options.capture());
        assertEquals(List.of(DEVICE, "https://example.org/types/Building"), options.getValue().types());
        assertEquals(List.of("myspace", "otherspace"), options.getValue().spaces());
    }

    @Test
    void listForwardsTheSearchTermToTheCore() throws Exception {
        when(instancesResource.list(any(InstanceListOptions.class))).thenReturn(page(List.of()));

        mockMvc.perform(get("/instances").param("search", " rack ").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());

        ArgumentCaptor<InstanceListOptions> options = ArgumentCaptor.forClass(InstanceListOptions.class);
        verify(instancesResource).list(options.capture());
        assertEquals("rack", options.getValue().searchByLabel());
    }

    @Test
    void listIgnoresABlankSearchTerm() throws Exception {
        when(instancesResource.list(any(InstanceListOptions.class))).thenReturn(page(List.of()));

        mockMvc.perform(get("/instances").param("search", "  ").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());

        ArgumentCaptor<InstanceListOptions> options = ArgumentCaptor.forClass(InstanceListOptions.class);
        verify(instancesResource).list(options.capture());
        assertNull(options.getValue().searchByLabel());
    }

    @Test
    void listWithoutInstancesDoesNotResolveTypesOrReleaseStatus() throws Exception {
        when(instancesResource.list(any(InstanceListOptions.class))).thenReturn(page(List.of()));

        mockMvc.perform(get("/instances").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        verifyNoInteractions(typesResource);
        verify(instancesResource, never()).releaseStatusByIds(any(), any());
    }

    @Test
    void listWithoutBearerTokenIsUnauthorized() throws Exception {
        mockMvc.perform(get("/instances")).andExpect(status().isUnauthorized());
        verify(client, never()).withToken(Mockito.anyString());
    }

    @Test
    void errorsOfTheCoreAreForwarded() throws Exception {
        when(instancesResource.list(any(InstanceListOptions.class))).thenThrow(new MarmotGraphApiException(403, "Forbidden", null, null));

        mockMvc.perform(get("/instances").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Forbidden"));
    }

}
