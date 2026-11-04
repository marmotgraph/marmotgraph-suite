package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.JsonLdDocument;
import org.marmotgraph.sdk.model.RoleMapping;
import org.marmotgraph.sdk.resources.SetupResource;
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

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(PermissionsTest.TestConfig.class)
class PermissionsTest {

    @EnableWebMvc
    @Import({Permissions.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
    static class TestConfig {
        @Bean
        MarmotGraphClient marmotGraphClient() {
            return Mockito.mock(MarmotGraphClient.class);
        }
    }

    @Autowired
    private MarmotGraphClient client;

    private SetupResource setup;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client);
        MarmotGraphClient userClient = Mockito.mock(MarmotGraphClient.class);
        setup = Mockito.mock(SetupResource.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        when(userClient.setup()).thenReturn(setup);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void listSplitsTheKeyIntoSpaceAndRoleSortedWithGlobalFirst() throws Exception {
        when(setup.listRoleDefinitions()).thenReturn(List.of(
                new JsonLdDocument(Map.of("_key", "myspace:owner", "roles", Map.of("group", List.of("owners")))),
                new JsonLdDocument(Map.of("_key", "myspace:consumer", "roles", Map.of("group", List.of("consumers")))),
                new JsonLdDocument(Map.of("_key", ":admin", "email", "admin@example.org")),
                new JsonLdDocument(Map.of("invalid", "no key"))));

        mockMvc.perform(get("/admin/permissions").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].space").doesNotExist())
                .andExpect(jsonPath("$[0].role").value("admin"))
                .andExpect(jsonPath("$[0].claims.email").value("admin@example.org"))
                .andExpect(jsonPath("$[0].claims._key").doesNotExist())
                .andExpect(jsonPath("$[1].space").value("myspace"))
                .andExpect(jsonPath("$[1].role").value("consumer"))
                .andExpect(jsonPath("$[2].role").value("owner"))
                .andExpect(jsonPath("$[2].claims.roles.group[0]").value("owners"));
    }

    @Test
    void rolesAreProvidedInTheOrderOfTheCore() throws Exception {
        mockMvc.perform(get("/admin/permissions/roles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("consumer"))
                .andExpect(jsonPath("$[4]").value("admin"));
    }

    @Test
    void updateAddsTheClaimToTheRoleOfTheSpace() throws Exception {
        when(setup.createRoleDefinition(eq(RoleMapping.EDITOR), eq(Map.of("roles", Map.of("group", List.of("editors")))), eq("myspace")))
                .thenReturn(new JsonLdDocument(Map.of("roles", Map.of("group", List.of("editors")))));

        mockMvc.perform(patch("/admin/permissions/editor").param("space", "myspace")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roles\": {\"group\": [\"editors\"]}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.space").value("myspace"))
                .andExpect(jsonPath("$.role").value("editor"))
                .andExpect(jsonPath("$.claims.roles.group[0]").value("editors"));
    }

    @Test
    void updateWithRemoveRemovesTheClaimFromTheGlobalRole() throws Exception {
        when(setup.deleteRoleDefinition(eq(RoleMapping.ADMIN), eq(Map.of("email", "admin@example.org")), Mockito.isNull()))
                .thenReturn(new JsonLdDocument(null));

        mockMvc.perform(patch("/admin/permissions/admin").param("remove", "true").param("space", " ")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\": \"admin@example.org\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.space").doesNotExist())
                .andExpect(jsonPath("$.claims").isEmpty());
        verify(setup, never()).createRoleDefinition(any(RoleMapping.class), anyMap(), any());
    }

    @Test
    void updateOfAnUnknownRoleIsRejected() throws Exception {
        mockMvc.perform(patch("/admin/permissions/superuser")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void errorsOfTheCoreAreForwarded() throws Exception {
        when(setup.listRoleDefinitions()).thenThrow(new MarmotGraphApiException(403, "You don't have the rights to show permissions", null, null));

        mockMvc.perform(get("/admin/permissions").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("You don't have the rights to show permissions"));
    }

}
