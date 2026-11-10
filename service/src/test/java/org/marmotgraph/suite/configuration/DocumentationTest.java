package org.marmotgraph.suite.configuration;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.context.annotation.Configuration;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The documentation of the deployment (DOCS_CUSTOM_DIR).
 */
class DocumentationTest {

    @EnableWebMvc
    @Configuration
    static class WebMvc {
    }

    @TempDir
    Path directory;

    private Path site;
    private AnnotationConfigWebApplicationContext context;

    @BeforeEach
    void setUp() throws IOException {
        site = Files.createDirectories(directory.resolve("site"));
        Files.writeString(site.resolve("index.html"), "<html>deployment</html>");
        Files.createDirectories(site.resolve("guidelines"));
        Files.writeString(site.resolve("guidelines/curation.html"), "<html>curation</html>");
        Files.writeString(directory.resolve("secret.txt"), "secret");
    }

    @AfterEach
    void tearDown() {
        context.close();
    }

    private MockMvc withCustomDirectory(String customDirectory) {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(WebMvc.class, SinglePageApplication.class);
        context.addBeanFactoryPostProcessor(beanFactory -> beanFactory.registerSingleton("documentation", new Documentation(customDirectory)));
        context.refresh();
        return MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void rootForwardsToItsIndex() throws Exception {
        MockMvc mockMvc = withCustomDirectory(site.toString());
        mockMvc.perform(get("/docs/custom")).andExpect(redirectedUrl("/docs/custom/"));
        mockMvc.perform(get("/docs/custom/")).andExpect(forwardedUrl("/docs/custom/index.html"));
    }

    @Test
    void pagesOfTheDeploymentAreServed() throws Exception {
        MockMvc mockMvc = withCustomDirectory(site.toString());
        mockMvc.perform(get("/docs/custom/index.html")).andExpect(status().isOk()).andExpect(content().string("<html>deployment</html>"));
        mockMvc.perform(get("/docs/custom/guidelines/curation.html")).andExpect(status().isOk()).andExpect(content().string("<html>curation</html>"));
    }

    @Test
    void newBuildsShowUpWithoutRestart() throws Exception {
        MockMvc mockMvc = withCustomDirectory(site.toString());
        mockMvc.perform(get("/docs/custom/new.html")).andExpect(status().isNotFound());
        Files.writeString(site.resolve("new.html"), "<html>new</html>");
        mockMvc.perform(get("/docs/custom/new.html")).andExpect(status().isOk()).andExpect(content().string("<html>new</html>"));
    }

    /** The suite's documentation hides its "Deployment" tab by asking for the index (see docs/javascripts/deployment.js) */
    @Test
    void notFoundWithoutDocumentationOfTheDeployment() throws Exception {
        MockMvc mockMvc = withCustomDirectory("");
        mockMvc.perform(head("/docs/custom/index.html")).andExpect(status().isNotFound());
        mockMvc.perform(get("/docs/custom/index.html")).andExpect(status().isNotFound());
    }

    @Test
    void notFoundIfTheDirectoryIsMissing() throws Exception {
        MockMvc mockMvc = withCustomDirectory(directory.resolve("missing").toString());
        mockMvc.perform(head("/docs/custom/index.html")).andExpect(status().isNotFound());
    }

    @Test
    void indexAnswersTheProbeOfTheTab() throws Exception {
        MockMvc mockMvc = withCustomDirectory(site.toString());
        mockMvc.perform(head("/docs/custom/index.html")).andExpect(status().isOk());
    }

    @Test
    void filesOutsideOfTheDirectoryAreNotServed() throws Exception {
        MockMvc mockMvc = withCustomDirectory(site.toString());
        mockMvc.perform(get(URI.create("/docs/custom/%2e%2e/secret.txt"))).andExpect(status().isNotFound());
        mockMvc.perform(get(URI.create("/docs/custom/..%2fsecret.txt"))).andExpect(status().isNotFound());
    }

}
