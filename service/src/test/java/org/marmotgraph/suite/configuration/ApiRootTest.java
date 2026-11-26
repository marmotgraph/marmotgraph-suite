package org.marmotgraph.suite.configuration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.suite.api.ApiExceptionHandler;
import org.marmotgraph.suite.api.Config;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.Optional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(ApiRootTest.TestConfig.class)
class ApiRootTest {

    @EnableWebMvc
    @Import({ApiRoot.class, Config.class, ApiExceptionHandler.class})
    static class TestConfig {
        @Bean
        CoreConnection coreConnection() {
            return Mockito.mock(CoreConnection.class, Mockito.RETURNS_DEEP_STUBS);
        }

        @Bean
        Variables variables() {
            Variables variables = Mockito.mock(Variables.class);
            Mockito.when(variables.shortCommitId()).thenReturn(Optional.empty());
            return variables;
        }
    }

    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void restEndpointsAreMappedBelowApiRoot() throws Exception {
        mockMvc.perform(get("/api/config")).andExpect(status().isOk());
        mockMvc.perform(get("/config")).andExpect(status().isNotFound());
    }

}
