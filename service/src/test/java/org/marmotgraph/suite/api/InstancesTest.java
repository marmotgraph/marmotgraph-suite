package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Instance;
import org.marmotgraph.sdk.model.Property;
import org.marmotgraph.sdk.model.ReleaseStatus;
import org.marmotgraph.sdk.model.ReleaseTreeScope;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.sdk.pagination.Page;
import org.marmotgraph.sdk.resources.InstanceListOptions;
import org.marmotgraph.sdk.resources.InstancesResource;
import org.marmotgraph.sdk.resources.ResponseOptions;
import org.marmotgraph.sdk.resources.TypesResource;
import org.marmotgraph.suite.auth.AuthenticatedClientResolver;
import org.marmotgraph.suite.configuration.ArgumentResolvers;
import org.marmotgraph.suite.configuration.Variables;
import org.marmotgraph.suite.types.FieldCache;
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

import java.util.HashMap;
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

        @Bean
        FieldCache fieldCache() {
            Variables variables = Mockito.mock(Variables.class);
            when(variables.typeCacheTtl()).thenReturn(300);
            return new FieldCache(variables);
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
    void getMapsTheInstanceOfTheCore() throws Exception {
        when(instancesResource.get(any(UUID.class), any(), any())).thenReturn(
                instance(RELEASED_ID, DEVICE, Map.of(NAME, "Server-Rack-A1", Instances.PERMISSIONS, List.of("READ", "WRITE"))));
        when(typesResource.getByNames(List.of(DEVICE), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(DEVICE, new TypeInformation(DEVICE, "A device in the data center", "Device", "#ff9800", NAME, null, null, List.of(), List.of(), List.of(), Map.of())));
        when(instancesResource.releaseStatus(RELEASED_ID, ReleaseTreeScope.TOP_INSTANCE_ONLY)).thenReturn(ReleaseStatus.RELEASED);

        mockMvc.perform(get("/instances/" + RELEASED_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instanceId").value(RELEASED_ID.toString()))
                .andExpect(jsonPath("$.type").value("Device"))
                .andExpect(jsonPath("$.typeDescription").value("A device in the data center"))
                .andExpect(jsonPath("$.typeColor").value("#ff9800"))
                .andExpect(jsonPath("$.instanceName").value("Server-Rack-A1"))
                .andExpect(jsonPath("$.space").value("myspace"))
                .andExpect(jsonPath("$.permissions").value("View, Edit"))
                .andExpect(jsonPath("$.releaseStatus").value("released"));

        ArgumentCaptor<ResponseOptions> options = ArgumentCaptor.forClass(ResponseOptions.class);
        verify(instancesResource).get(Mockito.eq(RELEASED_ID), Mockito.eq(Stage.IN_PROGRESS), options.capture());
        assertTrue(options.getValue().returnPermissions());
    }

    @Test
    void getProvidesTheFieldsOfTheInstanceInTheShapeOfTheirKind() throws Exception {
        String rack = "https://example.org/types/Rack";
        String blade = "https://example.org/types/Blade";
        String linkedId = "11111111-2222-4333-8444-555555555555";
        String restrictedId = "99999999-2222-4333-8444-555555555555";
        String unresolvedIdentifier = "https://example.org/blades/unknown";
        when(instancesResource.get(any(UUID.class), any(), any())).thenReturn(instance(RELEASED_ID, rack, Map.of(
                NAME, "Rack-1",
                "https://example.org/height", 42,
                "https://example.org/active", List.of("true"),
                "https://example.org/blades", List.of(
                        link("https://example.org/blades/7", "resolved", "https://kg.ebrains.eu/api/instances/" + linkedId, blade, "Blade-7", "otherspace"),
                        link("https://example.org/blades/8", "restricted", "https://kg.ebrains.eu/api/instances/" + restrictedId, blade, null, null),
                        link(unresolvedIdentifier, "unresolved", null, null, null, null)),
                "https://example.org/components", List.of(Map.of("x", "y")))));
        when(typesResource.getByNames(List.of(rack), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(rack, new TypeInformation(rack, null, "Rack", "#4caf50", NAME, null, null, List.of(), List.of(), List.of(), Map.of())));
        when(typesResource.getByNames(List.of(rack), Stage.IN_PROGRESS, null, true, false))
                .thenReturn(Map.of(rack, new TypeInformation(rack, null, "Rack", "#4caf50", NAME, null, null, List.of(), List.of(
                        new Property("https://example.org/components", "components", null, List.of(), Map.of()),
                        new Property("https://example.org/blades", "blades", null, List.of(), Map.of("https://editor.kg.ebrains.eu/vocab/meta/property/widget", "DynamicDropdown",
                                "https://core.kg.ebrains.eu/vocab/meta/orderNumber", 4)),
                        new Property("https://example.org/active", "active", null, List.of(), Map.of("https://editor.kg.ebrains.eu/vocab/meta/property/widget", "CheckBox",
                                "https://core.kg.ebrains.eu/vocab/meta/orderNumber", 3)),
                        new Property("https://example.org/height", "height", null, List.of(), Map.of("https://editor.kg.ebrains.eu/vocab/meta/property/widget", "InputNumber",
                                "https://core.kg.ebrains.eu/vocab/meta/orderNumber", 2)),
                        new Property(NAME, "name", null, List.of(), Map.of("https://editor.kg.ebrains.eu/vocab/meta/property/widget", "InputText",
                                "https://core.kg.ebrains.eu/vocab/meta/orderNumber", 1))
                ), List.of(), Map.of())));
        when(typesResource.getByNames(List.of(blade), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(blade, new TypeInformation(blade, null, "Blade", "#2196f3", NAME, null, null, List.of(), List.of(), List.of(), Map.of())));
        when(instancesResource.releaseStatus(RELEASED_ID, ReleaseTreeScope.TOP_INSTANCE_ONLY)).thenReturn(ReleaseStatus.RELEASED);

        mockMvc.perform(get("/instances/" + RELEASED_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fields.length()").value(5))
                .andExpect(jsonPath("$.fields[0].identifier").value(NAME))
                .andExpect(jsonPath("$.fields[0].label").value("Name"))
                .andExpect(jsonPath("$.fields[0].kind").value("TEXT"))
                .andExpect(jsonPath("$.fields[0].value").value("Rack-1"))
                .andExpect(jsonPath("$.fields[0].required").value(false))
                .andExpect(jsonPath("$.fields[1].kind").value("NUMBER"))
                .andExpect(jsonPath("$.fields[1].value").value(42))
                .andExpect(jsonPath("$.fields[2].kind").value("CHECKBOX"))
                .andExpect(jsonPath("$.fields[2].value").value(true))
                .andExpect(jsonPath("$.fields[3].kind").value("LINKS"))
                .andExpect(jsonPath("$.fields[3].value.length()").value(3))
                .andExpect(jsonPath("$.fields[3].value[0].instanceId").value(linkedId))
                .andExpect(jsonPath("$.fields[3].value[0].instanceName").value("Blade-7"))
                .andExpect(jsonPath("$.fields[3].value[0].type").value("Blade"))
                .andExpect(jsonPath("$.fields[3].value[0].typeColor").value("#2196f3"))
                .andExpect(jsonPath("$.fields[3].value[0].space").value("otherspace"))
                .andExpect(jsonPath("$.fields[3].value[0].linkStatus").value("resolved"))
                .andExpect(jsonPath("$.fields[3].value[1].instanceId").value(restrictedId))
                .andExpect(jsonPath("$.fields[3].value[1].instanceName").value(restrictedId))
                .andExpect(jsonPath("$.fields[3].value[1].type").value("Blade"))
                .andExpect(jsonPath("$.fields[3].value[1].typeColor").value("#2196f3"))
                .andExpect(jsonPath("$.fields[3].value[1].space").value(""))
                .andExpect(jsonPath("$.fields[3].value[1].linkStatus").value("restricted"))
                .andExpect(jsonPath("$.fields[3].value[2].instanceId").value(unresolvedIdentifier))
                .andExpect(jsonPath("$.fields[3].value[2].instanceName").value(unresolvedIdentifier))
                .andExpect(jsonPath("$.fields[3].value[2].type").value(""))
                .andExpect(jsonPath("$.fields[3].value[2].typeColor").doesNotExist())
                .andExpect(jsonPath("$.fields[3].value[2].linkStatus").value("unresolved"))
                .andExpect(jsonPath("$.fields[4].kind").value("UNSUPPORTED"))
                .andExpect(jsonPath("$.fields[4].value[0].x").value("y"))
                .andExpect(jsonPath("$.directLinks.length()").value(3))
                .andExpect(jsonPath("$.directLinks[0].instanceId").value(linkedId))
                .andExpect(jsonPath("$.directLinks[0].instanceName").value("Blade-7"))
                .andExpect(jsonPath("$.directLinks[0].fieldLabel").value("Blades"))
                .andExpect(jsonPath("$.directLinks[0].linkStatus").value("resolved"))
                .andExpect(jsonPath("$.directLinks[1].instanceId").value(restrictedId))
                .andExpect(jsonPath("$.directLinks[1].fieldLabel").value("Blades"))
                .andExpect(jsonPath("$.directLinks[1].linkStatus").value("restricted"))
                .andExpect(jsonPath("$.directLinks[2].instanceId").value(unresolvedIdentifier))
                .andExpect(jsonPath("$.directLinks[2].fieldLabel").value("Blades"))
                .andExpect(jsonPath("$.directLinks[2].linkStatus").value("unresolved"));

        ArgumentCaptor<ResponseOptions> options = ArgumentCaptor.forClass(ResponseOptions.class);
        verify(instancesResource).get(Mockito.eq(RELEASED_ID), Mockito.eq(Stage.IN_PROGRESS), options.capture());
        assertTrue(options.getValue().returnSummaryOfOutgoingLinks());
    }

    /**
     * A link as summarized by the core (all properties are present - with null values if not applicable).
     */
    private static Map<String, Object> link(String id, String status, String resolvedId, String type, String label, String space) {
        Map<String, Object> link = new HashMap<>();
        link.put("@id", id);
        link.put("@type", type);
        link.put(Instances.LINK_STATUS, status);
        link.put(Instances.LINK_RESOLVED_ID, resolvedId);
        link.put(Instances.LINK_LABEL, label);
        link.put(Instances.LINK_SPACE, space);
        return link;
    }

    @Test
    void getOfAnUnknownTypeFallsBackToTheIdentifiers() throws Exception {
        when(instancesResource.get(any(UUID.class), any(), any())).thenReturn(
                instance(UNRELEASED_ID, "https://example.org/types/Unknown", Map.of()));
        when(instancesResource.releaseStatus(UNRELEASED_ID, ReleaseTreeScope.TOP_INSTANCE_ONLY)).thenReturn(ReleaseStatus.HAS_CHANGED);

        mockMvc.perform(get("/instances/" + UNRELEASED_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("Unknown"))
                .andExpect(jsonPath("$.typeColor").doesNotExist())
                .andExpect(jsonPath("$.instanceName").value(UNRELEASED_ID.toString()))
                .andExpect(jsonPath("$.permissions").value(""))
                .andExpect(jsonPath("$.releaseStatus").value("in progress"))
                .andExpect(jsonPath("$.fields.length()").value(0))
                .andExpect(jsonPath("$.directLinks.length()").value(0));
    }

    @Test
    void getWithAnInvalidIdIsABadRequest() throws Exception {
        mockMvc.perform(get("/instances/not-a-uuid").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(instancesResource);
    }

    @Test
    void getForwardsANotFoundOfTheCore() throws Exception {
        when(instancesResource.get(any(UUID.class), any(), any())).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));

        mockMvc.perform(get("/instances/" + RELEASED_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isNotFound());
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
