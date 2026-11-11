package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Tool;
import org.marmotgraph.sdk.model.ToolCategory;
import org.marmotgraph.sdk.model.ToolDefinition;
import org.marmotgraph.sdk.model.ToolSpecification;
import org.marmotgraph.sdk.resources.ToolsResource;
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
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(ToolsTest.TestConfig.class)
class ToolsTest {

    private static final UUID SEARCH = UUID.fromString("5b0e6f0c-3f8e-4a43-9a51-6d1c2f9e7b10");
    private static final UUID DASHBOARD = UUID.fromString("0d6c2a9e-8f61-4c1b-b2a4-3e2f1c0d9a87");
    private static final String ICON = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>";

    @EnableWebMvc
    @Import({Tools.class, ToolsAdmin.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
    static class TestConfig {
        @Bean
        MarmotGraphClient marmotGraphClient() {
            return Mockito.mock(MarmotGraphClient.class);
        }
    }

    @Autowired
    private MarmotGraphClient client;

    private ToolsResource tools;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client);
        MarmotGraphClient userClient = Mockito.mock(MarmotGraphClient.class);
        tools = Mockito.mock(ToolsResource.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        when(userClient.tools()).thenReturn(tools);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void toolsAreGroupedByCategory() throws Exception {
        when(tools.listCategories()).thenReturn(List.of(new ToolCategory(DASHBOARD, "Dashboard", null), new ToolCategory(SEARCH, "Search", ICON)));
        when(tools.list()).thenReturn(List.of(new Tool(UUID.randomUUID(), "Dataset search", "Full text search",
                new Tool.CategoryReference(SEARCH, "Search"), "https://search.example.org")));

        // The dashboard category has no tools (it is only listed to users defining tools) - it is left out
        mockMvc.perform(get("/tools").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Search"))
                .andExpect(jsonPath("$[0].icon").value(ICON))
                .andExpect(jsonPath("$[0].tools[0].name").value("Dataset search"))
                .andExpect(jsonPath("$[0].tools[0].endpoint").value("https://search.example.org"));
    }

    @Test
    void toolsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/tools")).andExpect(status().isUnauthorized());
    }

    @Test
    void blankIconsAreRemoved() throws Exception {
        when(tools.updateCategory(SEARCH, "Search", null)).thenReturn(new ToolCategory(SEARCH, "Search", null));

        mockMvc.perform(put("/admin/tools/categories/" + SEARCH).header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"Search\", \"icon\": \"  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Search"));
        verify(tools).updateCategory(SEARCH, "Search", null);
    }

    @Test
    void definitionsAreForwarded() throws Exception {
        ToolSpecification specification = new ToolSpecification("Dataset search", null, SEARCH, "https://search.example.org",
                Map.of("authenticated", true));
        when(tools.create(any())).thenReturn(new ToolDefinition(UUID.randomUUID(), "Dataset search", null,
                new Tool.CategoryReference(SEARCH, "Search"), "https://search.example.org", Map.of("authenticated", true)));

        mockMvc.perform(post("/admin/tools/definitions").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Dataset search\", \"categoryId\": \"" + SEARCH + "\", \"endpoint\": \"https://search.example.org\", \"claims\": {\"authenticated\": true}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category.name").value("Search"));
        verify(tools).create(specification);
    }

    @Test
    void deleteForwardsTheId() throws Exception {
        mockMvc.perform(delete("/admin/tools/definitions/" + SEARCH).header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk());
        verify(tools).delete(SEARCH);
    }

}
