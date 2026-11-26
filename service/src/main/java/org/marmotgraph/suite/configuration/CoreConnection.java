/*
 * Copyright 2018 - 2021 Swiss Federal Institute of Technology Lausanne (EPFL)
 * Copyright 2021 - 2024 EBRAINS AISBL
 * Copyright 2024 - 2026 ETH Zurich
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0.
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 *  This open source software code was developed in part or in whole in the
 *  Human Brain Project, funded from the European Union's Horizon 2020
 *  Framework Programme for Research and Innovation under
 *  Specific Grant Agreements No. 720270, No. 785907, and No. 945539
 *  (Human Brain Project SGA1, SGA2 and SGA3).
 */

package org.marmotgraph.suite.configuration;

import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.MarmotGraphException;
import org.marmotgraph.sdk.auth.AuthenticationInformation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * The connection to the MarmotGraph core - and the OIDC configuration resolved from its (unauthenticated) setup
 * endpoint. The suite starts without the core: the OIDC configuration is resolved on demand and kept once it is known.
 * While the core can't be reached, a failed attempt is remembered for the retry interval so clients waiting for the
 * core to come back (e.g. the outage page of the UI) don't hit it with every request.
 */
@Slf4j
@Component
public class CoreConnection {

    private final MarmotGraphClient client;
    private final Duration retryInterval;
    private final Clock clock;

    private volatile AuthenticationInformation authenticationInformation;
    private volatile Failure lastFailure;

    private record Failure(Instant at, String reason) {
    }

    @Autowired
    public CoreConnection(MarmotGraphClient client, Variables variables) {
        this(client, Duration.ofSeconds(variables.coreConnectionRetryInterval()), Clock.systemUTC());
    }

    public CoreConnection(MarmotGraphClient client, Duration retryInterval, Clock clock) {
        this.client = client;
        this.retryInterval = retryInterval;
        this.clock = clock;
    }

    /** How long clients should wait before trying again if the core is unavailable. */
    public Duration retryInterval() {
        return retryInterval;
    }

    /**
     * The OIDC configuration of the core - resolved from the core on the first call (and after failed attempts).
     *
     * @throws CoreUnavailableException if the core (or its OIDC provider) can't be reached
     */
    public AuthenticationInformation authenticationInformation() {
        AuthenticationInformation known = authenticationInformation;
        return known != null ? known : discover();
    }

    /**
     * Like {@link #authenticationInformation()}, but also verifies that the core is (still) reachable - for the
     * entry point of the UI, which is useless without the core.
     *
     * @throws CoreUnavailableException if the core (or its OIDC provider) can't be reached
     */
    public AuthenticationInformation verifiedAuthenticationInformation() {
        AuthenticationInformation known = authenticationInformation;
        if (known == null) {
            return discover();
        }
        throwIfRecentlyFailed();
        try {
            client.setup().getAuthenticationConfig();
        } catch (MarmotGraphException e) {
            throw failed(e);
        }
        lastFailure = null;
        return known;
    }

    private synchronized AuthenticationInformation discover() {
        // Another thread might have succeeded (or failed) while this one was waiting
        if (authenticationInformation != null) {
            return authenticationInformation;
        }
        throwIfRecentlyFailed();
        AuthenticationInformation discovered;
        try {
            discovered = client.setup().discoverAuthentication();
        } catch (MarmotGraphException e) {
            throw failed(e);
        }
        if (discovered.authorizationEndpoint() == null) {
            throw failed(String.format("The OIDC configuration of the MarmotGraph core at %s doesn't contain an authorization endpoint", client.baseUrl()));
        }
        log.info("Connected to the MarmotGraph core at {}", client.baseUrl());
        lastFailure = null;
        authenticationInformation = discovered;
        return discovered;
    }

    private void throwIfRecentlyFailed() {
        Failure failure = lastFailure;
        if (failure != null && clock.instant().isBefore(failure.at().plus(retryInterval))) {
            throw new CoreUnavailableException(failure.reason(), retryInterval);
        }
    }

    private CoreUnavailableException failed(MarmotGraphException e) {
        return failed(String.format("The MarmotGraph core at %s is not reachable: %s", client.baseUrl(), e.getMessage()));
    }

    private CoreUnavailableException failed(String reason) {
        if (lastFailure == null) {
            log.warn("{} - retrying on demand every {}s", reason, retryInterval.toSeconds());
        }
        lastFailure = new Failure(clock.instant(), reason);
        return new CoreUnavailableException(reason, retryInterval);
    }

}
