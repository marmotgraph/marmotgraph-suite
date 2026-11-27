package org.marmotgraph.suite.configuration;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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
    @Import({ApiRoot.class, SinglePageApplication.class, Documentation.class, Failing.class})
    static class TestApplication {
    }

    /** Fails on purpose - for the error pages of the other statuses */
    @RestController
    static class Failing {
        @GetMapping("/failing/refused")
        String refused() {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        @GetMapping("/failing/broken")
        String broken() {
            throw new IllegalStateException("broken on purpose");
        }
    }

    private static final String BROWSER = "text/html,application/xhtml+xml,*/*;q=0.8";

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
    void browsersGetTheRefusedPageForOtherClientErrors() throws Exception {
        HttpResponse<String> response = get("/failing/refused", BROWSER);
        assertEquals(403, response.statusCode());
        assertTrue(response.headers().firstValue("Content-Type").orElseThrow().startsWith("text/html"));
        assertTrue(response.body().contains("This request can't be served"));
    }

    @Test
    void browsersGetTheServerErrorPage() throws Exception {
        HttpResponse<String> response = get("/failing/broken", BROWSER);
        assertEquals(500, response.statusCode());
        assertTrue(response.headers().firstValue("Content-Type").orElseThrow().startsWith("text/html"));
        assertTrue(response.body().contains("Something went wrong on our side"));
        assertFalse(response.body().contains("broken on purpose"));
    }

    @Test
    void apiClientsKeepTheJsonErrorOfAServerError() throws Exception {
        HttpResponse<String> response = get("/failing/broken", "application/json");
        assertEquals(500, response.statusCode());
        assertTrue(response.headers().firstValue("Content-Type").orElseThrow().startsWith("application/json"));
    }

    @Test
    void apiClientsKeepTheJsonError() throws Exception {
        HttpResponse<String> response = get("/api/doesNotExist", "application/json");
        assertEquals(404, response.statusCode());
        assertTrue(response.headers().firstValue("Content-Type").orElseThrow().startsWith("application/json"));
        assertFalse(response.body().contains("Page not found"));
    }

}
