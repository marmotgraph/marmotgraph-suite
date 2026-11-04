package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.ExecutionDetails;
import org.marmotgraph.sdk.model.IncomingLink;
import org.marmotgraph.sdk.model.JsonLdDocument;
import org.marmotgraph.sdk.model.Property;
import org.marmotgraph.sdk.model.QuerySpecification;
import org.marmotgraph.sdk.model.SourceType;
import org.marmotgraph.sdk.model.SpaceInformation;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.StoredQuery;
import org.marmotgraph.sdk.model.TargetType;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.sdk.pagination.Page;
import org.marmotgraph.sdk.resources.QueriesResource;
import org.marmotgraph.sdk.resources.QueryRunOptions;
import org.marmotgraph.sdk.resources.SpaceListOptions;
import org.marmotgraph.sdk.resources.SpacesResource;
import org.marmotgraph.sdk.resources.TypeListOptions;
import org.marmotgraph.sdk.resources.TypesResource;
import org.marmotgraph.suite.auth.AuthenticatedClientResolver;
import org.marmotgraph.suite.configuration.ArgumentResolvers;
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

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(QueriesTest.TestConfig.class)
class QueriesTest {

    private static final String PERSON = "https://example.org/types/Person";
    private static final String CITY = "https://example.org/types/City";
    private static final String LIVES_IN = "https://example.org/livesIn";
    private static final UUID QUERY_ID = UUID.fromString("a7d1c9f2-0000-4000-8000-000000000001");
    private static final String SPEC = "{\"meta\":{\"type\":\"" + PERSON + "\"},"
            + "\"structure\":[{\"propertyName\":\"name\",\"path\":[{\"property\":\"https://schema.org/name\"}],\"required\":true,\"ensureOrder\":true,"
            + "\"filter\":{\"op\":\"CONTAINS\",\"parameter\":\"name\"}}]}";

    @EnableWebMvc
    @Import({Queries.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
    static class TestConfig {
        @Bean
        MarmotGraphClient marmotGraphClient() {
            return Mockito.mock(MarmotGraphClient.class);
        }
    }

    @Autowired
    private MarmotGraphClient client;

    private MockMvc mockMvc;
    private QueriesResource queries;
    private SpacesResource spaces;
    private TypesResource types;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client);
        MarmotGraphClient userClient = Mockito.mock(MarmotGraphClient.class);
        queries = Mockito.mock(QueriesResource.class);
        spaces = Mockito.mock(SpacesResource.class);
        types = Mockito.mock(TypesResource.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        when(userClient.queries()).thenReturn(queries);
        when(userClient.spaces()).thenReturn(spaces);
        when(userClient.types()).thenReturn(types);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    private static StoredQuery storedQuery() {
        return new StoredQuery(QUERY_ID, "myspace", new QuerySpecification.Meta(PERSON, "People", "All persons"),
                List.of(QuerySpecification.StructureItem.of("name", QuerySpecification.Path.outgoing("https://schema.org/name"))));
    }

    private static <T> Page<T> page(List<T> items) {
        return new Page<>(items, items.size(), items.size(), null, null, Map.of(), null);
    }

    @Test
    void listsTheQueriesWithTheirMetaInformation() throws Exception {
        when(queries.list(eq(PERSON), isNull(), isNull(), anyInt(), anyBoolean())).thenReturn(page(List.of(storedQuery())));

        mockMvc.perform(get("/queries").param("type", PERSON).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(QUERY_ID.toString()))
                .andExpect(jsonPath("$[0].label").value("People"))
                .andExpect(jsonPath("$[0].description").value("All persons"))
                .andExpect(jsonPath("$[0].type").value(PERSON))
                .andExpect(jsonPath("$[0].space").value("myspace"));
    }

    @Test
    void providesTheSpecificationOfAStoredQuery() throws Exception {
        when(queries.getSpecification(QUERY_ID)).thenReturn(storedQuery());

        mockMvc.perform(get("/queries/" + QUERY_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(QUERY_ID.toString()))
                .andExpect(jsonPath("$.space").value("myspace"))
                .andExpect(jsonPath("$.specification.meta.type").value(PERSON))
                .andExpect(jsonPath("$.specification.meta.name").value("People"))
                .andExpect(jsonPath("$.specification.structure[0].propertyName").value("name"))
                .andExpect(jsonPath("$.specification.structure[0].path[0].property").value("https://schema.org/name"))
                .andExpect(jsonPath("$.specification.structure[0].required").doesNotExist());
    }

    @Test
    void flagsThePrivateSpaceAndProvidesThePermissions() throws Exception {
        when(spaces.get(Queries.PRIVATE_SPACE, true)).thenReturn(new SpaceInformation("private-123", "private-123", List.of("READ", "CREATE", "WRITE", "DELETE")));
        ArgumentCaptor<SpaceListOptions> options = ArgumentCaptor.forClass(SpaceListOptions.class);
        when(spaces.list(options.capture())).thenReturn(page(List.of(
                new SpaceInformation("team", "team", List.of("READ")),
                new SpaceInformation("private-123", "private-123", List.of("READ", "CREATE", "WRITE", "DELETE")))));

        mockMvc.perform(get("/queries/spaces").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].identifier").value("private-123"))
                .andExpect(jsonPath("$[0].isPrivate").value(true))
                .andExpect(jsonPath("$[0].canCreate").value(true))
                .andExpect(jsonPath("$[1].identifier").value("team"))
                .andExpect(jsonPath("$[1].isPrivate").value(false))
                .andExpect(jsonPath("$[1].canWrite").value(false));
        assertTrue(options.getValue().permissions());
    }

    @Test
    void listsTheSharedSpacesIfTheUserHasNoPrivateSpace() throws Exception {
        when(spaces.get(Queries.PRIVATE_SPACE, true)).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));
        when(spaces.list(any(SpaceListOptions.class))).thenReturn(page(List.of(new SpaceInformation("team", "team", List.of("CREATE")))));

        mockMvc.perform(get("/queries/spaces").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].canCreate").value(true));
    }

    @Test
    void providesThePropertiesAndIncomingLinksOfTheTypes() throws Exception {
        TypeInformation person = new TypeInformation(PERSON, null, "Person", "#ff0000", null, false, null, List.of(),
                List.of(new Property("https://schema.org/name", "Name", null, null, null, null, null, null, null, null),
                        new Property(LIVES_IN, "Lives in", "Inhabitants", null, null, null, null, null, null,
                                List.of(new TargetType(CITY, null, null)))), null);
        TypeInformation city = new TypeInformation(CITY, null, "City", null, null, false, null,
                List.of(new IncomingLink(LIVES_IN, null, List.of(new SourceType(PERSON, null, null)))), List.of(), null);
        ArgumentCaptor<TypeListOptions> options = ArgumentCaptor.forClass(TypeListOptions.class);
        when(types.list(options.capture())).thenReturn(page(List.of(person, city)));

        mockMvc.perform(get("/queries/types").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].identifier").value(CITY))
                .andExpect(jsonPath("$[0].properties[0].identifier").value(LIVES_IN))
                .andExpect(jsonPath("$[0].properties[0].reverse").value(true))
                .andExpect(jsonPath("$[0].properties[0].label").value("Inhabitants"))
                .andExpect(jsonPath("$[0].properties[0].targetTypes[0]").value(PERSON))
                .andExpect(jsonPath("$[1].identifier").value(PERSON))
                .andExpect(jsonPath("$[1].color").value("#ff0000"))
                .andExpect(jsonPath("$[1].properties[1].targetTypes[0]").value(CITY))
                .andExpect(jsonPath("$[1].properties[1].reverse").value(false));
        assertTrue(options.getValue().withProperties());
        assertTrue(options.getValue().withIncomingLinks());
        assertEquals(Stage.IN_PROGRESS, options.getValue().stage());
    }

    @Test
    void storesAQueryInTheGivenSpace() throws Exception {
        ArgumentCaptor<QuerySpecification> specification = ArgumentCaptor.forClass(QuerySpecification.class);
        when(queries.save(eq(QUERY_ID), specification.capture(), eq("team"))).thenReturn(storedQuery());

        mockMvc.perform(put("/queries/" + QUERY_ID).param("space", "team").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content(SPEC))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(QUERY_ID.toString()));
        assertEquals(PERSON, specification.getValue().meta().type());
        QuerySpecification.StructureItem name = specification.getValue().structure().getFirst();
        assertEquals("name", name.propertyName());
        assertEquals("https://schema.org/name", name.path().getFirst().property());
        assertEquals(true, name.required());
        assertEquals(true, name.ensureOrder());
        assertEquals(QuerySpecification.FilterOperation.CONTAINS, name.filter().op());
        assertEquals("name", name.filter().parameter());
    }

    @Test
    void rejectsQueriesWithoutRootType() throws Exception {
        mockMvc.perform(put("/queries/" + QUERY_ID).param("space", "team").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"meta\":{}}"))
                .andExpect(status().isBadRequest());
        verify(queries, never()).save(any(), any(), any());
    }

    @Test
    void rejectsInvalidSpaceNames() throws Exception {
        mockMvc.perform(put("/queries/" + QUERY_ID).param("space", "../x").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content(SPEC))
                .andExpect(status().isBadRequest());
        verify(queries, never()).save(any(), any(), any());
    }

    @Test
    void removesAQuery() throws Exception {
        mockMvc.perform(delete("/queries/" + QUERY_ID).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(queries).remove(QUERY_ID);
    }

    @Test
    void runsAQueryWithTheFilterParametersAndPaging() throws Exception {
        ArgumentCaptor<QueryRunOptions> options = ArgumentCaptor.forClass(QueryRunOptions.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> filterValues = ArgumentCaptor.forClass(Map.class);
        when(queries.run(any(), options.capture(), filterValues.capture())).thenReturn(new Page<>(
                List.of(new JsonLdDocument(Map.of("name", "Ada"))), 7, 1, "next", null, Map.of(),
                new ExecutionDetails(null, null, 12.5, null)));

        mockMvc.perform(post("/queries/run").param("stage", "IN_PROGRESS").param("size", "1").param("marker", "m1")
                        .param("restrictToSpaces", "team").param("country", "CH")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content(SPEC))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("Ada"))
                .andExpect(jsonPath("$.total").value(7))
                .andExpect(jsonPath("$.nextMarker").value("next"))
                .andExpect(jsonPath("$.durationInMs").value(12.5));
        assertEquals(Stage.IN_PROGRESS, options.getValue().stage());
        assertEquals(1, options.getValue().size());
        assertEquals("m1", options.getValue().marker());
        assertEquals(List.of("team"), options.getValue().restrictToSpaces());
        assertEquals(Map.of("country", "CH"), filterValues.getValue());
    }

}
