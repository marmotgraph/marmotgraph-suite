package org.marmotgraph.suite.configuration;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The error pages are rendered by the servlet container - unlike the other tests, this one needs a running server.
 */
@SpringBootTest(classes = ErrorPagesTest.TestApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ErrorPagesTest {

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @Import({ApiRoot.class, SinglePageApplication.class, Documentation.class})
    static class TestApplication {
    }

    @LocalServerPort
    private int port;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    private HttpResponse<String> get(String path, String accept) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).header("Accept", accept).GET().build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void browsersGetThePageNotFound() throws Exception {
        HttpResponse<String> response = get("/docs/doesNotExist.html", "text/html,application/xhtml+xml,*/*;q=0.8");
        assertEquals(404, response.statusCode());
        assertTrue(response.headers().firstValue("Content-Type").orElseThrow().startsWith("text/html"));
        assertTrue(response.body().contains("Page not found"));
    }

    @Test
    void apiClientsKeepTheJsonError() throws Exception {
        HttpResponse<String> response = get("/api/doesNotExist", "application/json");
        assertEquals(404, response.statusCode());
        assertTrue(response.headers().firstValue("Content-Type").orElseThrow().startsWith("application/json"));
        assertFalse(response.body().contains("Page not found"));
    }

}
