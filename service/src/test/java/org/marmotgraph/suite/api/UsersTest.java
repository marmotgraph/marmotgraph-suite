package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.UserInfo;
import org.marmotgraph.sdk.resources.UsersResource;
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

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(UsersTest.TestConfig.class)
class UsersTest {

    @EnableWebMvc
    @Import({Users.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
    static class TestConfig {
        @Bean
        MarmotGraphClient marmotGraphClient() {
            return Mockito.mock(MarmotGraphClient.class);
        }
    }

    @Autowired
    private MarmotGraphClient client;

    private MarmotGraphClient userClient;
    private UsersResource usersResource;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client);
        userClient = Mockito.mock(MarmotGraphClient.class);
        usersResource = Mockito.mock(UsersResource.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        when(userClient.users()).thenReturn(usersResource);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void meIsForwardedWithTheTokenOfTheUser() throws Exception {
        when(usersResource.me()).thenReturn(new UserInfo("jdoe", "Jane Doe", "jane@example.org", "Jane", "Doe", "123"));

        mockMvc.perform(get("/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userName").value("jdoe"))
                .andExpect(jsonPath("$.displayName").value("Jane Doe"));
    }

    @Test
    void meWithoutBearerTokenIsUnauthorized() throws Exception {
        mockMvc.perform(get("/users/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/users/me").header(HttpHeaders.AUTHORIZATION, "Basic abc")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer ")).andExpect(status().isUnauthorized());
        verify(client, never()).withToken(Mockito.anyString());
    }

    @Test
    void errorsOfTheCoreAreForwarded() throws Exception {
        when(usersResource.me()).thenThrow(new MarmotGraphApiException(401, "Token expired", null, null));

        mockMvc.perform(get("/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer theToken"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Token expired"));
    }

}
