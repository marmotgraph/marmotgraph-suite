package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Property;
import org.marmotgraph.sdk.model.PropertySpecification;
import org.marmotgraph.sdk.model.SpaceTypeInformation;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.TargetType;
import org.marmotgraph.sdk.model.TypeInSpace;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.sdk.model.TypeSpecification;
import org.marmotgraph.sdk.model.ValidationSchema;
import org.marmotgraph.sdk.pagination.Page;
import org.marmotgraph.sdk.resources.PropertiesResource;
import org.marmotgraph.sdk.resources.SpacesResource;
import org.marmotgraph.sdk.resources.TypeListOptions;
import org.marmotgraph.sdk.resources.TypesResource;
import org.marmotgraph.suite.auth.AuthenticatedClientResolver;
import org.marmotgraph.suite.configuration.ArgumentResolvers;
import org.marmotgraph.suite.spaces.SpaceCache;
import org.marmotgraph.suite.spaces.SpaceCache.SpaceDefinition;
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

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(ModelerTest.TestConfig.class)
class ModelerTest {

    private static final String DEVICE = "https://example.org/types/Device";
    private static final String ROOM = "https://example.org/types/Room";
    private static final String LOCATED_IN = "https://example.org/properties/locatedIn";

    @EnableWebMvc
    @Import({Modeler.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
    static class TestConfig {
        @Bean
        MarmotGraphClient marmotGraphClient() {
            return Mockito.mock(MarmotGraphClient.class);
        }

        @Bean
        TypeCache typeCache() {
            return Mockito.mock(TypeCache.class);
        }

        @Bean
        FieldCache fieldCache() {
            return Mockito.mock(FieldCache.class);
        }

        @Bean
        SpaceCache spaceCache() {
            return Mockito.mock(SpaceCache.class);
        }
    }

    @Autowired
    private MarmotGraphClient client;

    @Autowired
    private TypeCache typeCache;

    @Autowired
    private FieldCache fieldCache;

    @Autowired
    private SpaceCache spaceCache;

    private MarmotGraphClient userClient;
    private TypesResource types;
    private PropertiesResource properties;
    private SpacesResource spaces;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client, typeCache, fieldCache, spaceCache);
        userClient = Mockito.mock(MarmotGraphClient.class);
        types = Mockito.mock(TypesResource.class);
        properties = Mockito.mock(PropertiesResource.class);
        spaces = Mockito.mock(SpacesResource.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        when(userClient.types()).thenReturn(types);
        when(userClient.properties()).thenReturn(properties);
        when(userClient.spaces()).thenReturn(spaces);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void listProvidesTheTypesWithTheirPropertiesAndRelations() throws Exception {
        Property name = new Property("https://schema.org/name", "name", null, "InputText", null, null, true, 2, 10, List.of());
        Property locatedIn = new Property(LOCATED_IN, "located in", "Contains", "DynamicDropdown", null, null, null, 1, 5,
                List.of(new TargetType(ROOM, 5, List.of()), new TargetType(ROOM, 1, List.of())));
        TypeInformation device = new TypeInformation(DEVICE, "A device", "Device", "#ff9800", "https://schema.org/name", null, 10,
                null, List.of(name, locatedIn), List.of(new SpaceTypeInformation("myspace", 10, null)));
        ArgumentCaptor<TypeListOptions> options = ArgumentCaptor.forClass(TypeListOptions.class);
        when(types.list(options.capture())).thenReturn(new Page<>(List.of(device), 1, 50, null, null, Map.of(), null));

        mockMvc.perform(get("/modeler/types").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].identifier").value(DEVICE))
                .andExpect(jsonPath("$[0].embeddedOnly").value(false))
                .andExpect(jsonPath("$[0].spaces[0]").value("myspace"))
                // sorted by the order number
                .andExpect(jsonPath("$[0].properties[0].identifier").value(LOCATED_IN))
                .andExpect(jsonPath("$[0].properties[0].nameForReverseLink").value("Contains"))
                .andExpect(jsonPath("$[0].properties[0].targetTypes.length()").value(1))
                .andExpect(jsonPath("$[0].properties[0].targetTypes[0]").value(ROOM))
                .andExpect(jsonPath("$[0].properties[1].required").value(true))
                .andExpect(jsonPath("$[0].properties[1].targetTypes.length()").value(0));
        assertTrue(options.getValue().withProperties());
    }

    @Test
    void specificationIsProvidedByTheCore() throws Exception {
        when(types.getSpecification(DEVICE)).thenReturn(new TypeSpecification("Device", null, "#ff9800", null, List.of(), false));

        mockMvc.perform(get("/modeler/types/specification").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Device"))
                .andExpect(jsonPath("$.color").value("#ff9800"));
    }

    @Test
    void missingSpecificationIsEmpty() throws Exception {
        when(types.getSpecification(DEVICE)).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));

        mockMvc.perform(get("/modeler/types/specification").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(content().string(""));
    }

    @Test
    void emptySpecificationIsEmpty() throws Exception {
        when(types.getSpecification(DEVICE)).thenReturn(new TypeSpecification(null, null, null, null, null, false));

        mockMvc.perform(get("/modeler/types/specification").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(content().string(""));
    }

    @Test
    void specificationStatusOfTheTypesIsProvided() throws Exception {
        String building = "https://example.org/types/Building";
        String name = "https://schema.org/name";
        String serial = "https://example.org/properties/serialNumber";
        Property nameProperty = new Property(name, null, null, null, null, null, null, null, 5, List.of());
        Property serialProperty = new Property(serial, null, null, null, null, null, null, null, 5, List.of());
        Property locatedIn = new Property(LOCATED_IN, null, null, null, null, null, null, null, 5, List.of());
        ArgumentCaptor<TypeListOptions> options = ArgumentCaptor.forClass(TypeListOptions.class);
        when(types.list(options.capture())).thenReturn(new Page<>(List.of(
                new TypeInformation(DEVICE, null, null, null, null, null, 10, null, List.of(nameProperty, serialProperty, locatedIn), null),
                new TypeInformation(ROOM, null, null, null, null, null, 10, null, List.of(nameProperty), null),
                new TypeInformation(building, null, null, null, null, null, 10, null, null, null)), 3, 50, null, null, Map.of(), null));
        when(types.getSpecification(DEVICE)).thenReturn(new TypeSpecification("Device", null, null, null, List.of(), false));
        when(types.getSpecification(ROOM)).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));
        // An empty specification is provided with null values only
        when(types.getSpecification(building)).thenReturn(new TypeSpecification(null, null, null, null, List.of(), false));
        when(properties.get(name)).thenReturn(Optional.of(new PropertySpecification("name", null, null, null, null, null, null, null)));
        when(properties.get(serial)).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));
        when(properties.getForType(serial, DEVICE)).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));
        when(properties.getForType(LOCATED_IN, DEVICE)).thenReturn(Optional.of(
                new PropertySpecification(null, null, List.of(ROOM), null, null, null, null, null)));

        mockMvc.perform(get("/modeler/types/specificationStatus").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['" + DEVICE + "'].specified").value(true))
                .andExpect(jsonPath("$['" + DEVICE + "'].unspecifiedProperties").value(1))
                .andExpect(jsonPath("$['" + ROOM + "'].specified").value(false))
                .andExpect(jsonPath("$['" + ROOM + "'].unspecifiedProperties").value(0))
                .andExpect(jsonPath("$['" + building + "'].specified").value(false))
                .andExpect(jsonPath("$['" + building + "'].unspecifiedProperties").value(0));
        assertTrue(options.getValue().withProperties());
        // The global specification of a shared property is only looked up once
        verify(properties).get(name);
        verify(properties, never()).getForType(name, DEVICE);
    }

    @Test
    void definingTheSpecificationInvalidatesTheCaches() throws Exception {
        mockMvc.perform(put("/modeler/types/specification").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Device\", \"color\": \"#ff9800\", \"searchableProperties\": [\"https://schema.org/name\"], \"embeddedOnly\": true}"))
                .andExpect(status().isOk());

        ArgumentCaptor<TypeSpecification> specification = ArgumentCaptor.forClass(TypeSpecification.class);
        verify(types).createOrUpdateSpecification(Mockito.eq(DEVICE), specification.capture());
        assertEquals("Device", specification.getValue().name());
        assertEquals(List.of("https://schema.org/name"), specification.getValue().searchableProperties());
        assertTrue(specification.getValue().embeddedOnly());
        verify(typeCache).invalidate(DEVICE);
        verify(fieldCache).invalidate(DEVICE);
    }

    @Test
    void blankTypeIsRejected() throws Exception {
        mockMvc.perform(delete("/modeler/types/specification").param("type", " ").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isBadRequest());
        verify(types, never()).deleteSpecification(anyString());
    }

    @Test
    void propertyIsDefinedForTheType() throws Exception {
        mockMvc.perform(put("/modeler/types/properties").param("type", DEVICE).param("property", LOCATED_IN)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"located in\", \"targetTypes\": [\"" + ROOM + "\"], \"widget\": \"DynamicDropdown\", \"required\": true}"))
                .andExpect(status().isOk());

        ArgumentCaptor<PropertySpecification> specification = ArgumentCaptor.forClass(PropertySpecification.class);
        verify(properties).defineForType(Mockito.eq(LOCATED_IN), Mockito.eq(DEVICE), specification.capture());
        assertEquals(List.of(ROOM), specification.getValue().targetTypes());
        assertTrue(specification.getValue().required());
        verify(fieldCache).invalidate(DEVICE);
    }

    @Test
    void missingPropertySpecificationsAreNull() throws Exception {
        when(properties.getForType(LOCATED_IN, DEVICE)).thenReturn(Optional.empty());
        // An empty specification is provided with null values only
        when(properties.get(LOCATED_IN)).thenReturn(Optional.of(new PropertySpecification(null, null, null, null, null, null, null, null)));

        mockMvc.perform(get("/modeler/types/properties").param("type", DEVICE).param("property", LOCATED_IN)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value(nullValue()))
                .andExpect(jsonPath("$.global").value(nullValue()));
    }

    @Test
    void missingPropertySpecificationsReportedAsNotFoundAreNull() throws Exception {
        when(properties.getForType(LOCATED_IN, DEVICE)).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));
        when(properties.get(LOCATED_IN)).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));

        mockMvc.perform(get("/modeler/types/properties").param("type", DEVICE).param("property", LOCATED_IN)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value(nullValue()))
                .andExpect(jsonPath("$.global").value(nullValue()));
    }

    @Test
    void propertySpecificationsForTheTypeAndGlobalAreProvided() throws Exception {
        when(properties.getForType(LOCATED_IN, DEVICE)).thenReturn(Optional.of(
                new PropertySpecification(null, null, null, "DynamicTable", null, null, null, 2)));
        when(properties.get(LOCATED_IN)).thenReturn(Optional.of(
                new PropertySpecification("located in", "Contains", List.of(ROOM), "DynamicDropdown", null, "Where it is", true, 3)));

        mockMvc.perform(get("/modeler/types/properties").param("type", DEVICE).param("property", LOCATED_IN)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type.widget").value("DynamicTable"))
                .andExpect(jsonPath("$.type.name").value(nullValue()))
                .andExpect(jsonPath("$.type.orderNumber").value(2))
                .andExpect(jsonPath("$.global.name").value("located in"))
                .andExpect(jsonPath("$.global.targetTypes[0]").value(ROOM))
                .andExpect(jsonPath("$.global.widget").value("DynamicDropdown"));
    }

    @Test
    void propertyIsDefinedGlobally() throws Exception {
        mockMvc.perform(put("/modeler/properties").param("property", LOCATED_IN)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"located in\", \"targetTypes\": [\"" + ROOM + "\"], \"widget\": \"DynamicDropdown\"}"))
                .andExpect(status().isOk());

        ArgumentCaptor<PropertySpecification> specification = ArgumentCaptor.forClass(PropertySpecification.class);
        verify(properties).define(Mockito.eq(LOCATED_IN), specification.capture());
        assertEquals(List.of(ROOM), specification.getValue().targetTypes());
        // Any type might be affected
        verify(fieldCache).invalidateAll();
        verify(typeCache).invalidateAll();
    }

    @Test
    void blankGlobalPropertyIsRejected() throws Exception {
        mockMvc.perform(put("/modeler/properties").param("property", " ")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        verify(properties, never()).define(anyString(), any());
    }

    @Test
    void sourcesOfThePropertySpecificationsAreProvided() throws Exception {
        String name = "https://schema.org/name";
        String serial = "https://example.org/properties/serialNumber";
        String description = "https://schema.org/description";
        TypeInformation device = new TypeInformation(DEVICE, null, "Device", null, null, null, 10, null, List.of(
                new Property(LOCATED_IN, null, null, null, null, null, null, null, 5, List.of()),
                new Property(name, null, null, null, null, null, null, null, 5, List.of()),
                new Property(serial, null, null, null, null, null, null, null, 5, List.of()),
                new Property(description, null, null, null, null, null, null, null, 5, List.of())), List.of());
        when(types.getByNames(List.of(DEVICE), Stage.IN_PROGRESS, null, true, false)).thenReturn(Map.of(DEVICE, device));
        when(properties.getForType(LOCATED_IN, DEVICE)).thenReturn(Optional.of(
                new PropertySpecification(null, null, List.of(ROOM), null, null, null, null, null)));
        // An empty specification is provided with null values only
        when(properties.getForType(name, DEVICE)).thenReturn(Optional.of(
                new PropertySpecification(null, null, null, null, null, null, null, null)));
        when(properties.get(name)).thenReturn(Optional.of(new PropertySpecification("name", null, null, null, null, null, null, null)));
        when(properties.getForType(serial, DEVICE)).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));
        // Only ordering the property in the form of the type leaves its definition to the global specification
        when(properties.getForType(description, DEVICE)).thenReturn(Optional.of(
                new PropertySpecification(null, null, null, null, null, null, null, 4)));
        when(properties.get(description)).thenReturn(Optional.of(new PropertySpecification(null, null, null, "TextArea", null, null, null, null)));

        mockMvc.perform(get("/modeler/types/properties/sources").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['" + LOCATED_IN + "']").value("TYPE"))
                .andExpect(jsonPath("$['" + name + "']").value("GLOBAL"))
                .andExpect(jsonPath("$['" + serial + "']").value("NONE"))
                .andExpect(jsonPath("$['" + description + "']").value("GLOBAL"));
    }

    @Test
    void propertyIsRemovedFromTheType() throws Exception {
        mockMvc.perform(delete("/modeler/types/properties").param("type", DEVICE).param("property", LOCATED_IN)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());

        verify(properties).removeForType(LOCATED_IN, DEVICE);
        verify(typeCache).invalidate(DEVICE);
    }

    @Test
    void validationSchemasAreManagedByName() throws Exception {
        when(types.listValidationSchemas(DEVICE)).thenReturn(List.of(new ValidationSchema("my schema", Map.of("required", List.of("name")))));

        mockMvc.perform(get("/modeler/types/validationSchemas").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("my schema"))
                .andExpect(jsonPath("$[0].schema.required[0]").value("name"));

        mockMvc.perform(put("/modeler/types/validationSchemas/my schema").param("type", DEVICE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"required\": [\"name\"]}"))
                .andExpect(status().isOk());
        verify(types).createOrUpdateValidationSchema(DEVICE, "my schema", Map.of("required", List.of("name")));

        mockMvc.perform(delete("/modeler/types/validationSchemas/my schema").param("type", DEVICE)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(types).deleteValidationSchema(DEVICE, "my schema");
    }

    @Test
    void assignedSpacesAreCheckedForEachSpaceOfTheUser() throws Exception {
        when(spaceCache.list(userClient, AuthenticatedClientResolver.userKey("theToken")))
                .thenReturn(List.of(new SpaceDefinition("a", "a"), new SpaceDefinition("b", "b"), new SpaceDefinition("c", "c")));
        when(spaces.getType(any(), any())).thenReturn(Optional.empty());
        // The core reports a type which is not part of the space as not found
        when(spaces.getType("b", DEVICE)).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));
        when(spaces.getType("a", DEVICE)).thenReturn(Optional.of(new TypeInSpace("a", DEVICE)));
        when(spaces.getType("c", DEVICE)).thenReturn(Optional.of(new TypeInSpace("c", DEVICE)));

        mockMvc.perform(get("/modeler/types/spaces").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0]").value("a"))
                .andExpect(jsonPath("$[1]").value("c"));
    }

    @Test
    void typeIsAssignedToAndRemovedFromSpaces() throws Exception {
        mockMvc.perform(put("/modeler/types/spaces/myspace").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(spaces).assignType("myspace", DEVICE);

        mockMvc.perform(delete("/modeler/types/spaces/myspace").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(spaces).removeType("myspace", DEVICE);
    }

    @Test
    void removingATypeWhichIsNotPartOfTheSpaceSucceeds() throws Exception {
        Mockito.doThrow(new MarmotGraphApiException(404, "Not found", null, null)).when(spaces).removeType("myspace", DEVICE);

        mockMvc.perform(delete("/modeler/types/spaces/myspace").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
    }

    @Test
    void unsafeSpaceNameIsRejected() throws Exception {
        mockMvc.perform(put("/modeler/types/spaces/my space").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isBadRequest());
        verify(spaces, never()).assignType(anyString(), anyString());
    }

    @Test
    void errorsOfTheCoreAreForwarded() throws Exception {
        Mockito.doThrow(new MarmotGraphApiException(403, "Forbidden", null, null)).when(types).deleteSpecification(DEVICE);

        mockMvc.perform(delete("/modeler/types/specification").param("type", DEVICE).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isForbidden());
        verify(typeCache, never()).invalidate(anyString());
    }

    @Test
    void listWithoutBearerTokenIsUnauthorized() throws Exception {
        mockMvc.perform(get("/modeler/types")).andExpect(status().isUnauthorized());
        verify(client, never()).withToken(anyString());
    }

}
