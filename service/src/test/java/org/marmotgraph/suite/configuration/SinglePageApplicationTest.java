package org.marmotgraph.suite.configuration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.auth.AuthenticationInformation;
import org.marmotgraph.suite.api.Config;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.Optional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(SinglePageApplicationTest.TestConfig.class)
class SinglePageApplicationTest {

    @EnableWebMvc
    @Import({ApiRoot.class, SinglePageApplication.class, Config.class})
    static class TestConfig {
        @Bean
        AuthenticationInformation authenticationInformation() {
            return Mockito.mock(AuthenticationInformation.class);
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
    void clientSideRoutesAreAnsweredWithIndex() throws Exception {
        mockMvc.perform(get("/instances/123/edit"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
    }

    @Test
    void existingStaticFilesAreServed() throws Exception {
        mockMvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
    }

    @Test
    void apiEndpointsAreNotShadowed() throws Exception {
        mockMvc.perform(get("/api/config"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }

    @Test
    void unknownApiPathsAreNotFound() throws Exception {
        mockMvc.perform(get("/api/doesNotExist")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api")).andExpect(status().isNotFound());
    }

}
