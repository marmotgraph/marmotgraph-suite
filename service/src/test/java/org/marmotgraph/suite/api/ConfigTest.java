package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.suite.configuration.ApiRoot;
import org.marmotgraph.suite.configuration.CoreConnection;
import org.marmotgraph.suite.configuration.CoreUnavailableException;
import org.marmotgraph.suite.configuration.Variables;
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

import java.time.Duration;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(ConfigTest.TestConfig.class)
class ConfigTest {

    @EnableWebMvc
    @Import({ApiRoot.class, Config.class, ApiExceptionHandler.class})
    static class TestConfig {
        @Bean
        CoreConnection coreConnection() {
            return Mockito.mock(CoreConnection.class);
        }

        @Bean
        Variables variables() {
            Variables variables = Mockito.mock(Variables.class);
            when(variables.shortCommitId()).thenReturn(Optional.empty());
            when(variables.tenant()).thenReturn("cscs");
            return variables;
        }
    }

    @Autowired
    private CoreConnection coreConnection;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void reportsAnUnreachableCoreWithTheRetryInterval() throws Exception {
        when(coreConnection.verifiedAuthenticationInformation()).thenThrow(new CoreUnavailableException("The MarmotGraph core is not reachable", Duration.ofSeconds(7)));

        mockMvc.perform(get("/api/config"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string(HttpHeaders.RETRY_AFTER, "7"))
                .andExpect(jsonPath("$.retryInterval").value(7))
                .andExpect(jsonPath("$.tenant").value("cscs"))
                .andExpect(jsonPath("$.detail").value("The MarmotGraph core is not reachable"));
    }

}
