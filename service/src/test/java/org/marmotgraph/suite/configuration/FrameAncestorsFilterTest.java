package org.marmotgraph.suite.configuration;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class FrameAncestorsFilterTest {

    @Test
    void restrictsWhoMayEmbedTheSuite() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        new FrameAncestorsFilter("'self' https://app.example.org").doFilter(new MockHttpServletRequest(), response, chain);

        assertEquals("frame-ancestors 'self' https://app.example.org", response.getHeader("Content-Security-Policy"));
        assertNotNull(chain.getRequest());
    }

    @Test
    void appliesToTheDocumentationAsWell() throws Exception {
        assertEquals("frame-ancestors 'none'", policyOf("'none'", "/docs/"));
        assertEquals("frame-ancestors 'none'", policyOf("'none'", "/editor"));
    }

    private static String policyOf(String frameAncestors, String path) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        new FrameAncestorsFilter(frameAncestors).doFilter(new MockHttpServletRequest("GET", path), response, new MockFilterChain());
        return response.getHeader("Content-Security-Policy");
    }

}
