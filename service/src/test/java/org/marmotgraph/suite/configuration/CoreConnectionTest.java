package org.marmotgraph.suite.configuration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.MarmotGraphException;
import org.marmotgraph.sdk.auth.AuthenticationInformation;
import org.marmotgraph.sdk.resources.SetupResource;
import org.mockito.Mockito;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CoreConnectionTest {

    private static final Duration RETRY_INTERVAL = Duration.ofSeconds(5);

    private final SetupResource setup = Mockito.mock(SetupResource.class);
    private final AuthenticationInformation authenticationInformation = Mockito.mock(AuthenticationInformation.class);
    private Instant now = Instant.parse("2026-01-01T00:00:00Z");
    private CoreConnection connection;

    @BeforeEach
    void setUp() {
        MarmotGraphClient client = Mockito.mock(MarmotGraphClient.class);
        when(client.setup()).thenReturn(setup);
        when(client.baseUrl()).thenReturn("http://core");
        when(authenticationInformation.authorizationEndpoint()).thenReturn("http://auth/authorize");
        Clock clock = new Clock() {
            @Override
            public ZoneOffset getZone() {
                return ZoneOffset.UTC;
            }

            @Override
            public Clock withZone(java.time.ZoneId zone) {
                return this;
            }

            @Override
            public Instant instant() {
                return now;
            }
        };
        connection = new CoreConnection(client, RETRY_INTERVAL, clock);
    }

    @Test
    void discoversTheAuthenticationOnlyOnce() {
        when(setup.discoverAuthentication()).thenReturn(authenticationInformation);

        assertSame(authenticationInformation, connection.authenticationInformation());
        assertSame(authenticationInformation, connection.authenticationInformation());

        verify(setup, times(1)).discoverAuthentication();
    }

    @Test
    void retriesAnUnreachableCoreOnlyAfterTheRetryInterval() {
        when(setup.discoverAuthentication()).thenThrow(new MarmotGraphException("connection refused")).thenReturn(authenticationInformation);

        CoreUnavailableException failure = assertThrows(CoreUnavailableException.class, connection::authenticationInformation);
        assertEquals(RETRY_INTERVAL, failure.getRetryInterval());
        // Within the retry interval, the core isn't contacted again
        assertThrows(CoreUnavailableException.class, connection::authenticationInformation);
        verify(setup, times(1)).discoverAuthentication();

        now = now.plus(RETRY_INTERVAL);
        assertSame(authenticationInformation, connection.authenticationInformation());
    }

    @Test
    void verificationDetectsACoreGoneAfterTheDiscovery() {
        when(setup.discoverAuthentication()).thenReturn(authenticationInformation);
        connection.authenticationInformation();
        when(setup.getAuthenticationConfig()).thenThrow(new MarmotGraphException("connection refused"));

        assertThrows(CoreUnavailableException.class, connection::verifiedAuthenticationInformation);
        // The known OIDC configuration is kept for those not depending on the core being reachable right now
        assertSame(authenticationInformation, connection.authenticationInformation());
    }

    @Test
    void rejectsAnOidcConfigurationWithoutAuthorizationEndpoint() {
        when(authenticationInformation.authorizationEndpoint()).thenReturn(null);
        when(setup.discoverAuthentication()).thenReturn(authenticationInformation);

        assertThrows(CoreUnavailableException.class, connection::authenticationInformation);
    }

}
