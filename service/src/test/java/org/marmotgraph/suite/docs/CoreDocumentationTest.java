package org.marmotgraph.suite.docs;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.suite.configuration.Variables;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CoreDocumentationTest {

    private static final String PAGE = "<html>Instances</html>";
    private static final String ETAG = "\"abc\"";

    /** The paths requested from the core - with the If-None-Match header if there was one */
    private final List<String> requests = new CopyOnWriteArrayList<>();
    private HttpServer core;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() throws IOException {
        core = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        core.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getRawPath();
            String ifNoneMatch = exchange.getRequestHeaders().getFirst("If-None-Match");
            requests.add(ifNoneMatch != null ? path + " " + ifNoneMatch : path);
            switch (path) {
                case "/docs/index.html", "/docs/guide/instances.html" -> {
                    exchange.getResponseHeaders().add("ETag", ETAG);
                    if (ETAG.equals(ifNoneMatch)) {
                        exchange.sendResponseHeaders(304, -1);
                    } else {
                        byte[] body = PAGE.getBytes(StandardCharsets.UTF_8);
                        exchange.getResponseHeaders().add("Content-Type", "text/html");
                        exchange.getResponseHeaders().add("Set-Cookie", "session=core");
                        exchange.sendResponseHeaders(200, body.length);
                        exchange.getResponseBody().write(body);
                    }
                }
                case "/docs/broken.html" -> exchange.sendResponseHeaders(500, -1);
                default -> exchange.sendResponseHeaders(404, -1);
            }
            exchange.close();
        });
        core.start();
        mockMvc = MockMvcBuilders.standaloneSetup(new CoreDocumentation(variables("http://localhost:" + core.getAddress().getPort()))).build();
    }

    @AfterEach
    void tearDown() {
        core.stop(0);
    }

    private static Variables variables(String coreUrl) {
        Variables variables = Mockito.mock(Variables.class);
        Mockito.when(variables.coreUrl()).thenReturn(coreUrl);
        return variables;
    }

    @Test
    void pagesArePassedThrough() throws Exception {
        mockMvc.perform(get("/docs/core/guide/instances.html"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(PAGE))
                .andExpect(header().string("ETag", ETAG))
                .andExpect(header().doesNotExist("Set-Cookie"));
        assertEquals(List.of("/docs/guide/instances.html"), requests);
    }

    @Test
    void rootIsAnsweredWithTheIndex() throws Exception {
        mockMvc.perform(get("/docs/core/")).andExpect(status().isOk()).andExpect(content().string(PAGE));
        assertEquals(List.of("/docs/index.html"), requests);
    }

    @Test
    void rootWithoutTrailingSlashIsRedirected() throws Exception {
        mockMvc.perform(get("/docs/core")).andExpect(redirectedUrl("/docs/core/"));
        assertTrue(requests.isEmpty());
    }

    @Test
    void validatorsArePassedForRevalidation() throws Exception {
        mockMvc.perform(get("/docs/core/index.html").header("If-None-Match", ETAG)).andExpect(status().isNotModified());
        assertEquals(List.of("/docs/index.html " + ETAG), requests);
    }

    @Test
    void missingPagesAreNotFound() throws Exception {
        mockMvc.perform(get("/docs/core/doesNotExist.html")).andExpect(status().isNotFound());
    }

    @Test
    void failuresOfTheCoreAreBadGateway() throws Exception {
        mockMvc.perform(get("/docs/core/broken.html")).andExpect(status().isBadGateway());
    }

    @Test
    void unreachableCoreIsBadGateway() throws Exception {
        core.stop(0);
        mockMvc.perform(get("/docs/core/index.html")).andExpect(status().isBadGateway());
    }

    @Test
    void traversalIsRejected() throws Exception {
        mockMvc.perform(get(URI.create("/docs/core/%2e%2e/v4/users/me"))).andExpect(status().isNotFound());
        mockMvc.perform(get(URI.create("/docs/core/guide/%2e%2e/%2e%2e/v4/users/me"))).andExpect(status().isNotFound());
        assertTrue(requests.isEmpty());
    }

    @Test
    void onlyPagesOfTheDocumentationAreRequested() throws Exception {
        mockMvc.perform(get(URI.create("/docs/core//v4/users/me")));
        mockMvc.perform(get(URI.create("/docs/core/http:%2f%2fexample.org/")));
        assertTrue(requests.stream().allMatch(path -> URI.create(path).normalize().getPath().startsWith("/docs/")), requests::toString);
    }

}
