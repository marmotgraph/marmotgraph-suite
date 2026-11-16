package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.JsonLdDocument;
import org.marmotgraph.sdk.model.RoleMapping;
import org.marmotgraph.sdk.model.SpaceInformation;
import org.marmotgraph.sdk.model.SpaceSpecification;
import org.marmotgraph.sdk.model.Tool;
import org.marmotgraph.sdk.model.ToolCategory;
import org.marmotgraph.sdk.model.ToolDefinition;
import org.marmotgraph.sdk.model.ToolSpecification;
import org.marmotgraph.sdk.pagination.Page;
import org.marmotgraph.sdk.resources.SetupResource;
import org.marmotgraph.sdk.resources.SpaceListOptions;
import org.marmotgraph.sdk.resources.SpacesResource;
import org.marmotgraph.sdk.resources.TenantsResource;
import org.marmotgraph.sdk.resources.ToolsResource;
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
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(SettingsTransferTest.TestConfig.class)
class SettingsTransferTest {

    private static final UUID SEARCH = UUID.fromString("5b0e6f0c-3f8e-4a43-9a51-6d1c2f9e7b10");
    private static final UUID DATASET_SEARCH = UUID.fromString("0d6c2a9e-8f61-4c1b-b2a4-3e2f1c0d9a87");
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A};
    private static final String CSS = "@import url(https://fonts.example.org/inter.css);\nhtml * {\n font-family: Inter;\n}\n\n:root {\n --brand-primary: #000;\n}\n\n.custom { color: red; }";

    @EnableWebMvc
    @Import({SettingsTransfer.class, SpaceManagement.class, Permissions.class, Tenants.class, ToolsAdmin.class, ApiExceptionHandler.class,
            AuthenticatedClientResolver.class, ArgumentResolvers.class})
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

    private SpacesResource spaces;
    private SetupResource setup;
    private TenantsResource tenants;
    private ToolsResource tools;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client);
        MarmotGraphClient userClient = Mockito.mock(MarmotGraphClient.class);
        spaces = Mockito.mock(SpacesResource.class);
        setup = Mockito.mock(SetupResource.class);
        tenants = Mockito.mock(TenantsResource.class);
        tools = Mockito.mock(ToolsResource.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        when(userClient.spaces()).thenReturn(spaces);
        when(userClient.setup()).thenReturn(setup);
        when(userClient.tenants()).thenReturn(tenants);
        when(userClient.tools()).thenReturn(tools);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    @SuppressWarnings("unchecked")
    void exportContainsTheSettingsOfAllSections() throws Exception {
        Page<SpaceInformation> page = Mockito.mock(Page.class);
        when(page.allItems()).thenReturn(Stream.of(new SpaceInformation("specified", "specified", List.of("MANAGE_SPACE")),
                new SpaceInformation("unspecified", "unspecified", List.of("MANAGE_SPACE"))));
        when(spaces.list(any(SpaceListOptions.class))).thenReturn(page);
        when(spaces.getSpecification("specified")).thenReturn(new SpaceSpecification(null, "specified", true, false, true, true));
        when(spaces.getSpecification("unspecified")).thenReturn(new SpaceSpecification(null, "unspecified", false, false, false, false));
        when(setup.listRoleDefinitions()).thenReturn(List.of(new JsonLdDocument(Map.of("_key", "specified:owner", "email", "owner@example.org"))));
        when(tenants.list()).thenReturn(List.of("default", "mytenant"));
        when(tenants.get("mytenant")).thenReturn(new JsonLdDocument(Map.of("title", "My Tenant")));
        when(tenants.getCss("mytenant")).thenReturn(CSS);
        when(tenants.getLogo("mytenant", false)).thenReturn(Optional.of(PNG));
        when(tenants.getLogo("mytenant", true)).thenReturn(Optional.empty());
        when(tenants.getBackground(anyString(), anyBoolean())).thenReturn(Optional.empty());
        when(tenants.getFavicon("mytenant")).thenReturn(Optional.of("<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.UTF_8)));
        when(tools.listCategories()).thenReturn(List.of(new ToolCategory(SEARCH, "Search", "<svg/>")));
        when(tools.listDefinitions()).thenReturn(List.of(new ToolDefinition(DATASET_SEARCH, "Dataset search", null,
                new Tool.CategoryReference(SEARCH, "Search"), "https://search.example.org", Map.of("authenticated", true))));

        mockMvc.perform(get("/admin/settings/export").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.format").value(SettingsTransfer.FORMAT))
                .andExpect(jsonPath("$.version").value(SettingsTransfer.VERSION))
                .andExpect(jsonPath("$.spaces.length()").value(1))
                .andExpect(jsonPath("$.spaces[0].identifier").value("specified"))
                .andExpect(jsonPath("$.spaces[0].autoRelease").value(true))
                .andExpect(jsonPath("$.spaces[0].deferCache").value(true))
                .andExpect(jsonPath("$.permissions[0].space").value("specified"))
                .andExpect(jsonPath("$.permissions[0].role").value("owner"))
                .andExpect(jsonPath("$.permissions[0].claims.email").value("owner@example.org"))
                // The default tenant can't be modified - it is left out
                .andExpect(jsonPath("$.tenants.length()").value(1))
                .andExpect(jsonPath("$.tenants[0].name").value("mytenant"))
                .andExpect(jsonPath("$.tenants[0].theme.font.fontFamily").value("Inter"))
                .andExpect(jsonPath("$.tenants[0].theme.customCss").value(".custom { color: red; }"))
                .andExpect(jsonPath("$.tenants[0].images.length()").value(2))
                .andExpect(jsonPath("$.tenants[0].images[0].image").value("logo"))
                .andExpect(jsonPath("$.tenants[0].images[0].darkMode").value(false))
                .andExpect(jsonPath("$.tenants[0].images[0].contentType").value("image/png"))
                .andExpect(jsonPath("$.tenants[0].images[0].data").value(Base64.getEncoder().encodeToString(PNG)))
                .andExpect(jsonPath("$.tenants[0].images[1].image").value("favicon"))
                .andExpect(jsonPath("$.tenants[0].images[1].darkMode").doesNotExist())
                .andExpect(jsonPath("$.tenants[0].images[1].contentType").value("image/svg+xml"))
                .andExpect(jsonPath("$.tools.categories[0].name").value("Search"))
                .andExpect(jsonPath("$.tools.categories[0].id").doesNotExist())
                .andExpect(jsonPath("$.tools.definitions[0].name").value("Dataset search"))
                .andExpect(jsonPath("$.tools.definitions[0].category").value("Search"))
                .andExpect(jsonPath("$.tools.definitions[0].id").doesNotExist());
    }

    @Test
    void exportContainsTheSelectedSectionsOnly() throws Exception {
        when(tools.listCategories()).thenReturn(List.of());
        when(tools.listDefinitions()).thenReturn(List.of());

        mockMvc.perform(get("/admin/settings/export").param("sections", "tools").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tools.categories.length()").value(0))
                .andExpect(jsonPath("$.spaces").doesNotExist())
                .andExpect(jsonPath("$.permissions").doesNotExist())
                .andExpect(jsonPath("$.tenants").doesNotExist());
        verifyNoInteractions(spaces, setup, tenants);
    }

    @Test
    void importAppliesTheSettingsInTheOrderOfTheirDependencies() throws Exception {
        String png = Base64.getEncoder().encodeToString(PNG);
        when(tools.listCategories()).thenReturn(List.of(new ToolCategory(SEARCH, "Search", null)));
        UUID dashboards = UUID.randomUUID();
        when(tools.createCategory("Dashboards", null)).thenReturn(new ToolCategory(dashboards, "Dashboards", null));
        when(tools.updateCategory(SEARCH, "Search", "<svg/>")).thenReturn(new ToolCategory(SEARCH, "Search", "<svg/>"));
        when(tools.listDefinitions()).thenReturn(List.of(new ToolDefinition(DATASET_SEARCH, "Dataset search", null,
                new Tool.CategoryReference(SEARCH, "Search"), "https://old.example.org", Map.of())));
        when(tools.update(eq(DATASET_SEARCH), any())).thenReturn(new ToolDefinition(DATASET_SEARCH, "Dataset search", null, null, null, null));
        when(tools.create(any())).thenReturn(new ToolDefinition(UUID.randomUUID(), "Overview", null, null, null, null));
        when(setup.createRoleDefinition(eq(RoleMapping.OWNER), any(), eq("project"))).thenReturn(new JsonLdDocument(Map.of()));

        String document = """
                {
                  "format": "marmotgraph-suite-settings",
                  "version": 1,
                  "spaces": [{"identifier": "project", "autoRelease": true, "clientSpace": false, "deferCache": false}],
                  "permissions": [
                    {"space": "project", "role": "owner", "claims": {"email": "owner@example.org"}},
                    {"role": "unknown", "claims": {"email": "x@example.org"}}
                  ],
                  "tenants": [{"name": "mytenant", "title": "My Tenant",
                    "theme": {"font": {"fontFamily": "Inter"}, "colors": {"brandColors": {"primary": "#000"}}, "customCss": ".a {}"},
                    "images": [{"image": "logo", "darkMode": false, "contentType": "image/png", "data": "%s"}]}],
                  "tools": {
                    "categories": [{"name": "Search", "icon": "<svg/>"}, {"name": "Dashboards"}],
                    "definitions": [
                      {"name": "Dataset search", "category": "Search", "endpoint": "https://search.example.org"},
                      {"name": "Overview", "category": "Dashboards", "endpoint": "https://overview.example.org", "claims": {"groups": ["a"]}},
                      {"name": "Orphan", "category": "Missing", "endpoint": "https://orphan.example.org"}
                    ]
                  }
                }
                """.formatted(png);

        mockMvc.perform(post("/admin/settings/import").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content(document))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(9))
                .andExpect(jsonPath("$[0].section").value("tenants"))
                .andExpect(jsonPath("$[0].error").doesNotExist())
                .andExpect(jsonPath("$[1].section").value("spaces"))
                .andExpect(jsonPath("$[2].item").value("owner (project)"))
                .andExpect(jsonPath("$[2].error").doesNotExist())
                .andExpect(jsonPath("$[3].item").value("unknown (global)"))
                .andExpect(jsonPath("$[3].error").value("Unknown role \"unknown\""))
                .andExpect(jsonPath("$[4].item").value("Category Search"))
                .andExpect(jsonPath("$[5].item").value("Category Dashboards"))
                .andExpect(jsonPath("$[6].error").doesNotExist())
                .andExpect(jsonPath("$[7].error").doesNotExist())
                .andExpect(jsonPath("$[8].item").value("Orphan"))
                .andExpect(jsonPath("$[8].error").value("The category \"Missing\" doesn't exist"));

        var order = inOrder(tenants, spaces, setup, tools);
        order.verify(tenants).define(eq("mytenant"), any());
        order.verify(tenants).setFont(eq("mytenant"), any());
        order.verify(tenants).setCustomCss("mytenant", ".a {}");
        order.verify(tenants).setLogo("mytenant", PNG, "logo.png", "image/png", false);
        order.verify(spaces).createOrUpdateSpecification(eq("project"), any());
        order.verify(setup).createRoleDefinition(RoleMapping.OWNER, Map.of("email", "owner@example.org"), "project");
        order.verify(tools).updateCategory(SEARCH, "Search", "<svg/>");
        order.verify(tools).createCategory("Dashboards", null);
        // The incomplete color scheme is skipped since the core would reject it
        verify(tenants, never()).setColors(anyString(), any());
        // Existing tools are matched by their name - tools without claims are listed to every authenticated user
        verify(tools).update(DATASET_SEARCH, new ToolSpecification("Dataset search", null, SEARCH, "https://search.example.org",
                ToolSpecification.EVERY_AUTHENTICATED_USER));
        verify(tools).create(new ToolSpecification("Overview", null, dashboards, "https://overview.example.org", Map.of("groups", List.of("a"))));
    }

    @Test
    void importOfTheSelectedSectionsOnly() throws Exception {
        mockMvc.perform(post("/admin/settings/import").param("sections", "spaces").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"format": "marmotgraph-suite-settings", "version": 1,
                                 "spaces": [{"identifier": "project", "autoRelease": false, "clientSpace": true, "deferCache": false}],
                                 "permissions": [{"role": "admin", "claims": {"email": "admin@example.org"}}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        verify(spaces).createOrUpdateSpecification("project", new SpaceSpecification(null, null, false, true, false));
        verifyNoInteractions(setup);
    }

    @Test
    void failuresOfTheCoreAreReportedPerSetting() throws Exception {
        Mockito.doThrow(new MarmotGraphApiException(403, "Forbidden", null, null)).when(tenants).define(eq("mytenant"), any());

        mockMvc.perform(post("/admin/settings/import").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"format": "marmotgraph-suite-settings", "version": 1,
                                 "tenants": [{"name": "mytenant"}, {"name": "default"}, {"name": "invalid name"}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].error").value("Forbidden (403)"))
                .andExpect(jsonPath("$[1].error").value("The default tenant can not be modified"))
                .andExpect(jsonPath("$[2].error").exists());
    }

    @Test
    void documentsOfAnotherFormatOrALaterVersionAreRejected() throws Exception {
        mockMvc.perform(post("/admin/settings/import").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"spaces\": []}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/admin/settings/import").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"format\": \"marmotgraph-suite-settings\", \"version\": 2}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(spaces, setup, tenants, tools);
    }

    @Test
    void contentTypeIsDerivedFromTheContent() {
        assertEquals("image/png", SettingsTransfer.contentType(PNG));
        assertEquals("image/jpeg", SettingsTransfer.contentType(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0}));
        assertEquals("image/x-icon", SettingsTransfer.contentType(new byte[]{0, 0, 1, 0, 1}));
        assertEquals("image/svg+xml", SettingsTransfer.contentType("<?xml version=\"1.0\"?><svg/>".getBytes(StandardCharsets.UTF_8)));
        assertEquals("application/octet-stream", SettingsTransfer.contentType(new byte[]{1, 2}));
    }

}
