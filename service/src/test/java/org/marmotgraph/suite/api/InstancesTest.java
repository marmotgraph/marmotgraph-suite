package org.marmotgraph.suite.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Instance;
import org.marmotgraph.sdk.model.LinkingInstance;
import org.marmotgraph.sdk.model.Property;
import org.marmotgraph.sdk.model.ReleaseStatus;
import org.marmotgraph.sdk.model.ReleaseTreeScope;
import org.marmotgraph.sdk.model.Scope;
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
import org.springframework.http.MediaType;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
    private static final UUID NEVER_RELEASED_ID = UUID.fromString("0f1e2d3c-4b5a-4968-8776-655443322110");

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
        Instance instance = new Instance(Map.of("@id", id, "@type", type,
                "_space", "myspace"));
        instance.putAll(properties);
        return instance;
    }

    private static Page<Instance> page(List<Instance> items) {
        return new Page<>(items, items.size(), 50, null, null, Map.of(), null);
    }

    @Test
    void listMapsTheInstancesOfTheCore() throws Exception {
        when(instancesResource.list(any(InstanceListOptions.class))).thenReturn(page(List.of(
                instance(RELEASED_ID, DEVICE, Map.of(NAME, "Server-Rack-A1", "_permissions", List.of("RELEASE", "READ", "WRITE", "DELETE"),
                        "_releaseStatus", "RELEASED", "_validation", List.of(Map.of("name", "minimal", "valid", true, "compliance", 100.0, "errors", List.of()),
                                Map.of("name", "complete", "valid", false, "compliance", 62.5, "errors", List.of())))),
                instance(UNRELEASED_ID, "https://example.org/types/Unknown", Map.of("_permissions", List.of("READ"), "_releaseStatus", "HAS_CHANGED")),
                instance(NEVER_RELEASED_ID, DEVICE, Map.of(NAME, "Server-Rack-B2", "_releaseStatus", "UNRELEASED"))
        )));
        when(typesResource.getByNames(List.of(DEVICE, "https://example.org/types/Unknown"), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(DEVICE, new TypeInformation(DEVICE, "A device in the data center", "Device", "#ff9800", NAME, null, null, List.of(), List.of(), List.of())));

        mockMvc.perform(get("/instances").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instances.length()").value(3))
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.instances[0].id").value(1))
                .andExpect(jsonPath("$.instances[0].instanceId").value(RELEASED_ID.toString()))
                .andExpect(jsonPath("$.instances[0].type").value("Device"))
                .andExpect(jsonPath("$.instances[0].typeDescription").value("A device in the data center"))
                .andExpect(jsonPath("$.instances[0].typeColor").value("#ff9800"))
                .andExpect(jsonPath("$.instances[0].instanceName").value("Server-Rack-A1"))
                .andExpect(jsonPath("$.instances[0].space").value("myspace"))
                .andExpect(jsonPath("$.instances[0].permissions").value("View, Edit, Release"))
                .andExpect(jsonPath("$.instances[0].bookmarked").value(false))
                .andExpect(jsonPath("$.instances[0].lastVisited").doesNotExist())
                .andExpect(jsonPath("$.instances[0].releaseStatus").value("released"))
                .andExpect(jsonPath("$.instances[0].validation.length()").value(2))
                .andExpect(jsonPath("$.instances[0].validation[0].name").value("minimal"))
                .andExpect(jsonPath("$.instances[0].validation[0].valid").value(true))
                .andExpect(jsonPath("$.instances[0].validation[0].compliance").value(100.0))
                .andExpect(jsonPath("$.instances[0].validation[1].name").value("complete"))
                .andExpect(jsonPath("$.instances[0].validation[1].valid").value(false))
                .andExpect(jsonPath("$.instances[0].validation[1].compliance").value(62.5))
                .andExpect(jsonPath("$.instances[1].type").value("Unknown"))
                .andExpect(jsonPath("$.instances[1].typeDescription").doesNotExist())
                .andExpect(jsonPath("$.instances[1].typeColor").doesNotExist())
                .andExpect(jsonPath("$.instances[1].instanceName").value(UNRELEASED_ID.toString()))
                .andExpect(jsonPath("$.instances[1].permissions").value("View"))
                .andExpect(jsonPath("$.instances[1].releaseStatus").value("has changed"))
                .andExpect(jsonPath("$.instances[1].validation.length()").value(0))
                .andExpect(jsonPath("$.instances[2].releaseStatus").value("in progress"));

        ArgumentCaptor<InstanceListOptions> options = ArgumentCaptor.forClass(InstanceListOptions.class);
        verify(instancesResource).list(options.capture());
        assertEquals(Stage.IN_PROGRESS, options.getValue().stage());
        assertTrue(options.getValue().responseOptions().returnPermissions());
        assertTrue(options.getValue().responseOptions().returnValidationResults());
        assertTrue(options.getValue().responseOptions().returnReleaseStatus());
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
    void listReportsTheTotalOfTheCore() throws Exception {
        when(instancesResource.list(any(InstanceListOptions.class))).thenReturn(new Page<>(
                List.of(instance(RELEASED_ID, DEVICE, Map.of(NAME, "Server-Rack-A1"))), 1234, 50, null, null, Map.of(), null));
        when(typesResource.getByNames(List.of(DEVICE), Stage.IN_PROGRESS, null, false, false)).thenReturn(Map.of());

        mockMvc.perform(get("/instances").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instances.length()").value(1))
                .andExpect(jsonPath("$.total").value(1234));
    }

    @Test
    void listWithoutInstancesDoesNotResolveTypes() throws Exception {
        when(instancesResource.list(any(InstanceListOptions.class))).thenReturn(page(List.of()));

        mockMvc.perform(get("/instances").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instances.length()").value(0))
                .andExpect(jsonPath("$.total").value(0));
        verifyNoInteractions(typesResource);
    }

    @Test
    void getMapsTheInstanceOfTheCore() throws Exception {
        when(instancesResource.get(any(UUID.class), any(), any())).thenReturn(
                instance(RELEASED_ID, DEVICE, Map.of(NAME, "Server-Rack-A1", "_permissions", List.of("READ", "WRITE"))));
        when(typesResource.getByNames(List.of(DEVICE), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(DEVICE, new TypeInformation(DEVICE, "A device in the data center", "Device", "#ff9800", NAME, null, null, List.of(), List.of(), List.of())));
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
                        link("https://example.org/blades/7", "resolved", linkedId, blade, "Blade-7", "otherspace", false),
                        link("https://example.org/blades/8", "restricted", restrictedId, blade, null, null, null),
                        link(unresolvedIdentifier, "unresolved", null, null, null, null, null)),
                "https://example.org/components", List.of(Map.of("x", "y")))));
        when(typesResource.getByNames(List.of(rack), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(rack, new TypeInformation(rack, null, "Rack", "#4caf50", NAME, null, null, List.of(), List.of(), List.of())));
        when(typesResource.getByNames(List.of(rack), Stage.IN_PROGRESS, null, true, false))
                .thenReturn(Map.of(rack, new TypeInformation(rack, null, "Rack", "#4caf50", NAME, null, null, List.of(), List.of(
                        new Property("https://example.org/components", "components", null, null, null, null, null, null, null, List.of()),
                        new Property("https://example.org/blades", "blades", null, "DynamicDropdown", null, null, null, 4, null, List.of()),
                        new Property("https://example.org/active", "active", null, "CheckBox", null, null, null, 3, null, List.of()),
                        new Property("https://example.org/height", "height", null, "InputNumber", null, null, null, 2, null, List.of()),
                        new Property(NAME, "name", null, "InputText", null, null, null, 1, null, List.of())
                ), List.of())));
        when(typesResource.getByNames(List.of(blade), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(blade, new TypeInformation(blade, null, "Blade", "#2196f3", NAME, null, null, List.of(), List.of(), List.of())));
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
                .andExpect(jsonPath("$.directLinks[0].hasDirectLinks").value(false))
                .andExpect(jsonPath("$.directLinks[0].hasReverseLinks").value(true))
                .andExpect(jsonPath("$.directLinks[1].instanceId").value(restrictedId))
                .andExpect(jsonPath("$.directLinks[1].fieldLabel").value("Blades"))
                .andExpect(jsonPath("$.directLinks[1].linkStatus").value("restricted"))
                .andExpect(jsonPath("$.directLinks[1].hasDirectLinks").doesNotExist())
                .andExpect(jsonPath("$.directLinks[1].hasReverseLinks").doesNotExist())
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
    private static Map<String, Object> link(String id, String status, String resolvedId, String type, String label, String space,
                                            Boolean hasOutgoingLinks) {
        Map<String, Object> link = new HashMap<>();
        link.put("@id", id);
        link.put("@type", type);
        link.put(Instances.LINK_STATUS, status);
        link.put(Instances.LINK_RESOLVED_ID, resolvedId);
        link.put(Instances.LINK_LABEL, label);
        link.put(Instances.LINK_SPACE, space);
        link.put(Instances.LINK_HAS_OUTGOING_LINKS, hasOutgoingLinks);
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
                .andExpect(jsonPath("$.releaseStatus").value("has changed"))
                .andExpect(jsonPath("$.fields.length()").value(0))
                .andExpect(jsonPath("$.directLinks.length()").value(0));
    }

    @Test
    void incomingLinksAreGroupedByPropertyAndTypeAndLabeledWithTheNameForTheReverseLink() throws Exception {
        String dataset = "https://example.org/types/IncomingDataset";
        String person = "https://example.org/types/IncomingPerson";
        String author = "https://example.org/author";
        String contact = "https://example.org/contact";
        UUID datasetId = UUID.fromString("11111111-2222-4333-8444-555555555555");
        UUID restrictedId = UUID.fromString("99999999-2222-4333-8444-555555555555");
        Map<String, Map<String, Page<LinkingInstance>>> byProperty = new java.util.LinkedHashMap<>();
        byProperty.put(author, Map.of(dataset, new Page<>(List.of(
                new LinkingInstance(datasetId, dataset, "Dataset-1", "otherspace", LinkingInstance.RESOLVED, true, null),
                new LinkingInstance(restrictedId, dataset, null, null, LinkingInstance.RESTRICTED, null, null)), 12, 2, "m1", null, Map.of(), null)));
        byProperty.put(contact, Map.of(person, new Page<>(List.of(
                new LinkingInstance(datasetId, person, "", "people", LinkingInstance.RESOLVED, false, null)), 1, 1, null, null, Map.of(), null)));
        when(instancesResource.incomingLinks(RELEASED_ID, null, null, Stage.IN_PROGRESS, null, 10, true)).thenReturn(byProperty);
        when(typesResource.getByNames(List.of(dataset, person), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(dataset, new TypeInformation(dataset, null, "Dataset", "#2196f3", NAME, null, null, List.of(), List.of(), List.of())));
        when(typesResource.getByNames(List.of(dataset, person), Stage.IN_PROGRESS, null, true, false))
                .thenReturn(Map.of(
                        dataset, new TypeInformation(dataset, null, "Dataset", "#2196f3", NAME, null, null, List.of(), List.of(
                                new Property(author, "author", "Is author of", null, null, null, null, null, null, List.of())
                        ), List.of()),
                        person, new TypeInformation(person, null, null, null, NAME, null, null, List.of(), List.of(
                                new Property(contact, "contact", null, null, null, null, null, null, null, List.of())
                        ), List.of())));

        mockMvc.perform(get("/instances/" + RELEASED_ID + "/incomingLinks").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].property").value(author))
                .andExpect(jsonPath("$[0].label").value("Is author of"))
                .andExpect(jsonPath("$[0].types.length()").value(1))
                .andExpect(jsonPath("$[0].types[0].typeIdentifier").value(dataset))
                .andExpect(jsonPath("$[0].types[0].type").value("Dataset"))
                .andExpect(jsonPath("$[0].types[0].typeColor").value("#2196f3"))
                .andExpect(jsonPath("$[0].types[0].total").value(12))
                .andExpect(jsonPath("$[0].types[0].nextMarker").value("m1"))
                .andExpect(jsonPath("$[0].types[0].links[0].instanceId").value(datasetId.toString()))
                .andExpect(jsonPath("$[0].types[0].links[0].instanceName").value("Dataset-1"))
                .andExpect(jsonPath("$[0].types[0].links[0].type").doesNotExist())
                .andExpect(jsonPath("$[0].types[0].links[0].typeColor").doesNotExist())
                .andExpect(jsonPath("$[0].types[0].links[0].space").value("otherspace"))
                .andExpect(jsonPath("$[0].types[0].links[0].linkStatus").value("resolved"))
                .andExpect(jsonPath("$[0].types[0].links[0].hasDirectLinks").value(true))
                .andExpect(jsonPath("$[0].types[0].links[0].hasReverseLinks").value(true))
                .andExpect(jsonPath("$[0].types[0].links[1].instanceId").value(restrictedId.toString()))
                .andExpect(jsonPath("$[0].types[0].links[1].space").value(""))
                .andExpect(jsonPath("$[0].types[0].links[1].linkStatus").value("restricted"))
                .andExpect(jsonPath("$[0].types[0].links[1].hasDirectLinks").doesNotExist())
                .andExpect(jsonPath("$[0].types[0].links[1].hasReverseLinks").doesNotExist())
                .andExpect(jsonPath("$[1].label").value("Contact"))
                .andExpect(jsonPath("$[1].types[0].type").value("IncomingPerson"))
                .andExpect(jsonPath("$[1].types[0].typeColor").doesNotExist())
                .andExpect(jsonPath("$[1].types[0].nextMarker").doesNotExist())
                .andExpect(jsonPath("$[1].types[0].links[0].instanceName").value(datasetId.toString()))
                .andExpect(jsonPath("$[1].types[0].links[0].hasDirectLinks").value(true))
                .andExpect(jsonPath("$[1].types[0].links[0].hasReverseLinks").value(false));
    }

    @Test
    void incomingLinksForwardTheMarkerAndPageSizeToTheCore() throws Exception {
        when(instancesResource.incomingLinks(RELEASED_ID, null, null, Stage.IN_PROGRESS, "m1", 5, true)).thenReturn(Map.of());

        mockMvc.perform(get("/instances/" + RELEASED_ID + "/incomingLinks").param("size", "5").param("marker", "m1")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        verify(instancesResource).incomingLinks(RELEASED_ID, null, null, Stage.IN_PROGRESS, "m1", 5, true);
        verifyNoInteractions(typesResource);
    }

    @Test
    void getRawProvidesTheDocumentOfTheCoreWithoutInternalProperties() throws Exception {
        when(instancesResource.get(any(UUID.class), any(), any())).thenReturn(
                instance(RELEASED_ID, DEVICE, Map.of(NAME, "Server-Rack-A1", "https://example.org/unknown", List.of(Map.of("@value", 42)))));

        mockMvc.perform(get("/instances/" + RELEASED_ID + "/raw").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['@type']").value(DEVICE))
                .andExpect(jsonPath("$['" + NAME + "']").value("Server-Rack-A1"))
                .andExpect(jsonPath("$['https://example.org/unknown'][0]['@value']").value(42))
                .andExpect(jsonPath("$._space").doesNotExist());

        verify(instancesResource).get(RELEASED_ID, Stage.IN_PROGRESS, ResponseOptions.DEFAULT);
    }

    @Test
    void replaceRawForwardsTheDocumentToTheCore() throws Exception {
        when(instancesResource.replace(Mockito.eq(RELEASED_ID), any())).thenReturn(instance(RELEASED_ID, DEVICE, Map.of(NAME, "Renamed")));

        mockMvc.perform(put("/instances/" + RELEASED_ID + "/raw").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"@type\": \"" + DEVICE + "\", \"" + NAME + "\": \"Renamed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['" + NAME + "']").value("Renamed"))
                .andExpect(jsonPath("$._space").doesNotExist());

        verify(instancesResource).replace(RELEASED_ID, Map.of("@type", DEVICE, NAME, "Renamed"));
    }

    @Test
    void replaceRawForwardsAForbiddenOfTheCore() throws Exception {
        when(instancesResource.replace(Mockito.eq(RELEASED_ID), any())).thenThrow(new MarmotGraphApiException(403, "Forbidden", null, null));

        mockMvc.perform(put("/instances/" + RELEASED_ID + "/raw").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateSendsTheChangedFieldsAsJsonLdToTheCore() throws Exception {
        String rack = "https://example.org/types/Rack";
        String linkedId = "11111111-2222-4333-8444-555555555555";
        when(instancesResource.get(any(UUID.class), any(), any())).thenReturn(instance(RELEASED_ID, rack, Map.of(NAME, "Rack-1")));
        when(typesResource.getByNames(List.of(rack), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(rack, new TypeInformation(rack, null, "Rack", "#4caf50", NAME, null, null, List.of(), List.of(), List.of())));
        when(typesResource.getByNames(List.of(rack), Stage.IN_PROGRESS, null, true, false))
                .thenReturn(Map.of(rack, new TypeInformation(rack, null, "Rack", "#4caf50", NAME, null, null, List.of(), List.of(
                        new Property(NAME, "name", null, "InputText", null, null, null, 1, null, List.of()),
                        new Property("https://example.org/height", "height", null, "InputNumber", null, null, null, 2, null, List.of()),
                        new Property("https://example.org/blades", "blades", null, "DynamicDropdown", null, null, null, 3, null, List.of())
                ), List.of())));
        when(instancesResource.releaseStatus(RELEASED_ID, ReleaseTreeScope.TOP_INSTANCE_ONLY)).thenReturn(ReleaseStatus.RELEASED);

        mockMvc.perform(patch("/instances/" + RELEASED_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"%s": "Renamed", "https://example.org/height": "",
                                 "https://example.org/blades": [{"instanceId": "%s", "instanceName": "Blade-7"}]}
                                """.formatted(NAME, linkedId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instanceId").value(RELEASED_ID.toString()));

        Map<String, Object> expected = new HashMap<>();
        expected.put(NAME, "Renamed");
        expected.put("https://example.org/height", null);
        expected.put("https://example.org/blades", List.of(Map.of("@id", linkedId)));
        verify(instancesResource).update(RELEASED_ID, expected);
    }

    @Test
    void updateRejectsUnknownFields() throws Exception {
        when(instancesResource.get(any(UUID.class), any(), any())).thenReturn(instance(RELEASED_ID, DEVICE, Map.of()));
        when(typesResource.getByNames(List.of(DEVICE), Stage.IN_PROGRESS, null, true, false))
                .thenReturn(Map.of(DEVICE, new TypeInformation(DEVICE, null, "Device", null, NAME, null, null, List.of(), List.of(), List.of())));

        mockMvc.perform(patch("/instances/" + RELEASED_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"https://example.org/unknown\": 1}"))
                .andExpect(status().isBadRequest());

        verify(instancesResource, never()).update(any(), any());
    }

    @Test
    void createSendsTheFilledInFieldsAsJsonLdToTheCoreWithTheGivenId() throws Exception {
        String rack = "https://example.org/types/Rack";
        String linkedId = "11111111-2222-4333-8444-555555555555";
        when(typesResource.getByNames(List.of(rack), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(rack, new TypeInformation(rack, null, "Rack", "#4caf50", NAME, null, null, List.of(), List.of(), List.of())));
        when(typesResource.getByNames(List.of(rack), Stage.IN_PROGRESS, null, true, false))
                .thenReturn(Map.of(rack, new TypeInformation(rack, null, "Rack", "#4caf50", NAME, null, null, List.of(), List.of(
                        new Property(NAME, "name", null, "InputText", null, null, null, 1, null, List.of()),
                        new Property("https://example.org/height", "height", null, "InputNumber", null, null, null, 2, null, List.of()),
                        new Property("https://example.org/blades", "blades", null, "DynamicDropdown", null, null, null, 3, null, List.of())
                ), List.of())));
        when(instancesResource.get(any(UUID.class), any(), any())).thenReturn(instance(NEVER_RELEASED_ID, rack, Map.of(NAME, "Rack-2")));
        when(instancesResource.releaseStatus(NEVER_RELEASED_ID, ReleaseTreeScope.TOP_INSTANCE_ONLY)).thenReturn(ReleaseStatus.UNRELEASED);

        mockMvc.perform(post("/instances/" + NEVER_RELEASED_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type": "%s", "fields": {"%s": "Rack-2", "https://example.org/height": "",
                                 "https://example.org/blades": [{"instanceId": "%s", "instanceName": "Blade-7"}]}}
                                """.formatted(rack, NAME, linkedId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instanceId").value(NEVER_RELEASED_ID.toString()))
                .andExpect(jsonPath("$.instanceName").value("Rack-2"));

        // Empty fields are left out - the instance is created in the private space of the user if no space is given
        verify(instancesResource).createWithId(NEVER_RELEASED_ID, "myspace", Map.of(
                "@type", List.of(rack),
                NAME, "Rack-2",
                "https://example.org/blades", List.of(Map.of("@id", linkedId))));
    }

    @Test
    void createRejectsUnknownFields() throws Exception {
        when(typesResource.getByNames(List.of(DEVICE), Stage.IN_PROGRESS, null, true, false))
                .thenReturn(Map.of(DEVICE, new TypeInformation(DEVICE, null, "Device", null, NAME, null, null, List.of(), List.of(), List.of())));

        mockMvc.perform(post("/instances/" + NEVER_RELEASED_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\": \"" + DEVICE + "\", \"fields\": {\"https://example.org/unknown\": 1}}"))
                .andExpect(status().isBadRequest());

        verify(instancesResource, never()).createWithId(any(), any(), any());
    }

    @Test
    void createRequiresAType() throws Exception {
        mockMvc.perform(post("/instances/" + NEVER_RELEASED_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"fields\": {}}"))
                .andExpect(status().isBadRequest());

        verify(instancesResource, never()).createWithId(any(), any(), any());
    }

    /** The scope as deserialized by the SDK from the response of the core */
    private static Scope scope(String json) throws Exception {
        return new ObjectMapper().readValue(json, Scope.class);
    }

    @Test
    void scopeProvidesTheReleaseTreeWithStatusAndPermissions() throws Exception {
        String json = """
                {"@id": "%s", "@type": "%s", "_space": "myspace", "_label": "Server-Rack-A1",
                 "_permissions": ["READ", "RELEASE", "UNRELEASE"], "_releaseStatus": "HAS_CHANGED",
                 "_children": [
                   {"@id": "%s", "@type": "https://example.org/types/Unknown", "_space": "other",
                    "_permissions": ["READ"], "_releaseStatus": "RELEASED"},
                   {"@id": "%s", "@type": "%s", "_space": "myspace", "_label": "Server-Rack-B2",
                    "_permissions": ["READ", "RELEASE"], "_releaseStatus": "UNRELEASED"}
                 ]}
                """.formatted(RELEASED_ID, DEVICE, UNRELEASED_ID, NEVER_RELEASED_ID, DEVICE);
        when(instancesResource.scope(RELEASED_ID, null, Stage.IN_PROGRESS, true, true)).thenReturn(scope(json));
        when(typesResource.getByNames(List.of(DEVICE, "https://example.org/types/Unknown"), Stage.IN_PROGRESS, null, false, false))
                .thenReturn(Map.of(DEVICE, new TypeInformation(DEVICE, "A device in the data center", "Device", "#ff9800", NAME, null, null, List.of(), List.of(), List.of())));

        mockMvc.perform(get("/instances/" + RELEASED_ID + "/scope").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instanceId").value(RELEASED_ID.toString()))
                .andExpect(jsonPath("$.instanceName").value("Server-Rack-A1"))
                .andExpect(jsonPath("$.type").value("Device"))
                .andExpect(jsonPath("$.typeColor").value("#ff9800"))
                .andExpect(jsonPath("$.space").value("myspace"))
                .andExpect(jsonPath("$.releaseStatus").value("has changed"))
                .andExpect(jsonPath("$.canRelease").value(true))
                .andExpect(jsonPath("$.canUnrelease").value(true))
                .andExpect(jsonPath("$.children.length()").value(2))
                .andExpect(jsonPath("$.children[0].instanceId").value(UNRELEASED_ID.toString()))
                .andExpect(jsonPath("$.children[0].instanceName").value(UNRELEASED_ID.toString()))
                .andExpect(jsonPath("$.children[0].type").value("Unknown"))
                .andExpect(jsonPath("$.children[0].typeColor").doesNotExist())
                .andExpect(jsonPath("$.children[0].releaseStatus").value("released"))
                .andExpect(jsonPath("$.children[0].canRelease").value(false))
                .andExpect(jsonPath("$.children[0].canUnrelease").value(false))
                .andExpect(jsonPath("$.children[0].children.length()").value(0))
                .andExpect(jsonPath("$.children[1].instanceName").value("Server-Rack-B2"))
                .andExpect(jsonPath("$.children[1].releaseStatus").value("in progress"))
                .andExpect(jsonPath("$.children[1].canRelease").value(true))
                .andExpect(jsonPath("$.children[1].canUnrelease").value(false));
    }

    @Test
    void releaseIsForwardedToTheCore() throws Exception {
        mockMvc.perform(put("/instances/" + RELEASED_ID + "/release").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(instancesResource).release(RELEASED_ID);
    }

    @Test
    void unreleaseIsForwardedToTheCore() throws Exception {
        mockMvc.perform(delete("/instances/" + RELEASED_ID + "/release").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(instancesResource).unrelease(RELEASED_ID);
    }

    @Test
    void releaseForwardsAForbiddenOfTheCore() throws Exception {
        Mockito.doThrow(new MarmotGraphApiException(403, "Forbidden", null, null)).when(instancesResource).release(RELEASED_ID);

        mockMvc.perform(put("/instances/" + RELEASED_ID + "/release").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Forbidden"));
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
