package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.GraphStatistics;
import org.marmotgraph.sdk.resources.StatisticsResource;
import org.marmotgraph.suite.auth.AuthenticatedClientResolver;
import org.marmotgraph.suite.configuration.ArgumentResolvers;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(StatisticsTest.TestConfig.class)
class StatisticsTest {

    @EnableWebMvc
    @Import({Statistics.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
    static class TestConfig {
        @Bean
        MarmotGraphClient marmotGraphClient() {
            return Mockito.mock(MarmotGraphClient.class);
        }
    }

    @Autowired
    private MarmotGraphClient client;

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        Mockito.reset(client);
        when(client.withToken(any())).thenReturn(client);
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void providesTheStatisticsOfTheCore() throws Exception {
        StatisticsResource resource = Mockito.mock(StatisticsResource.class);
        when(client.statistics()).thenReturn(resource);
        when(resource.get()).thenReturn(new GraphStatistics(
                new GraphStatistics.Totals(84, 449),
                new GraphStatistics.Totals(64, 404),
                List.of(new GraphStatistics.TypeStatistics("https://example.org/Language", "Language", "#123456", 27, 20)),
                List.of(new GraphStatistics.ValidationStatistics("minimal", 12, 84, 78, 4, 2, 0, 0, 0))));

        mvc.perform(get("/statistics").header(HttpHeaders.AUTHORIZATION, "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.live.instances").value(84))
                .andExpect(jsonPath("$.released.triples").value(404))
                .andExpect(jsonPath("$.types[0].name").value("Language"))
                .andExpect(jsonPath("$.types[0].liveInstances").value(27))
                .andExpect(jsonPath("$.validation[0].schema").value("minimal"))
                .andExpect(jsonPath("$.validation[0].above80Percent").value(4));
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get("/statistics")).andExpect(status().isUnauthorized());
        verifyNoInteractions(client);
    }
}
