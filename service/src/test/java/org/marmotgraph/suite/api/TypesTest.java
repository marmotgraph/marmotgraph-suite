package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.suite.auth.AuthenticatedClientResolver;
import org.marmotgraph.suite.configuration.ArgumentResolvers;
import org.marmotgraph.suite.types.FieldCache;
import org.marmotgraph.suite.types.FieldCache.FieldDefinition;
import org.marmotgraph.suite.types.FieldKind;
import org.marmotgraph.suite.types.TypeCache;
import org.marmotgraph.suite.types.TypeCache.TypeDefinition;
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

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(TypesTest.TestConfig.class)
class TypesTest {

    @EnableWebMvc
    @Import({Types.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
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
    }

    @Autowired
    private MarmotGraphClient client;

    @Autowired
    private TypeCache cache;

    @Autowired
    private FieldCache fieldCache;

    private MarmotGraphClient userClient;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client, cache, fieldCache);
        userClient = Mockito.mock(MarmotGraphClient.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void listIsProvidedByTheCacheWithTheClientOfTheUser() throws Exception {
        when(cache.list(userClient, AuthenticatedClientResolver.userKey("theToken"))).thenReturn(List.of(new TypeDefinition("https://example.org/types/Device", "Device", null, "#ff9800", "http://schema.org/name")));

        mockMvc.perform(get("/types").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].identifier").value("https://example.org/types/Device"))
                .andExpect(jsonPath("$[0].name").value("Device"))
                .andExpect(jsonPath("$[0].color").value("#ff9800"));
    }

    @Test
    void listWithoutBearerTokenIsUnauthorized() throws Exception {
        mockMvc.perform(get("/types")).andExpect(status().isUnauthorized());
        verify(client, never()).withToken(Mockito.anyString());
    }

    @Test
    void errorsOfTheCoreAreForwarded() throws Exception {
        when(cache.list(userClient, AuthenticatedClientResolver.userKey("theToken"))).thenThrow(new MarmotGraphApiException(403, "Forbidden", null, null));

        mockMvc.perform(get("/types").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Forbidden"));
    }

    @Test
    void fieldsOfTheTypeAreProvidedEmpty() throws Exception {
        String device = "https://example.org/types/Device";
        when(fieldCache.get(userClient, device)).thenReturn(List.of(
                new FieldDefinition("http://schema.org/name", "Name", FieldKind.TEXT, 1, true, false, "The name", List.of(), null),
                new FieldDefinition("https://example.org/rack", "Rack", FieldKind.LINK, 2, false, false, null, List.of("https://example.org/types/Rack"), null),
                new FieldDefinition("https://example.org/blades", "Blades", FieldKind.LINKS, 3, false, true, null, List.of(), null)));

        mockMvc.perform(get("/types/fields").param("type", device).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].identifier").value("http://schema.org/name"))
                .andExpect(jsonPath("$[0].label").value("Name"))
                .andExpect(jsonPath("$[0].kind").value("TEXT"))
                .andExpect(jsonPath("$[0].required").value(true))
                .andExpect(jsonPath("$[0].tooltip").value("The name"))
                .andExpect(jsonPath("$[0].value").doesNotExist())
                .andExpect(jsonPath("$[1].value").doesNotExist())
                .andExpect(jsonPath("$[1].targetTypes[0]").value("https://example.org/types/Rack"))
                .andExpect(jsonPath("$[2].value.length()").value(0))
                .andExpect(jsonPath("$[2].readOnly").value(true));
    }

}
