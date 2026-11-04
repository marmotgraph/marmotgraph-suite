package org.marmotgraph.suite.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

class AuthenticatedClientResolverTest {

    @Test
    void userKeyIsTheSha256OfTheToken() {
        assertEquals("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", AuthenticatedClientResolver.userKey("test"));
        assertNotEquals(AuthenticatedClientResolver.userKey("test"), AuthenticatedClientResolver.userKey("other"));
    }

}
