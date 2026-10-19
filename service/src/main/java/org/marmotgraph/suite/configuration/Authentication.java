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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.Map;

/**
 * Resolves the OIDC configuration from the (unauthenticated) setup endpoint of the MarmotGraph core.
 * Since the suite can't offer a login without it, the startup is blocked until the core is reachable
 * (or the configured number of retries is exhausted).
 */
@Configuration
public class Authentication {

    private static final Logger log = LoggerFactory.getLogger(Authentication.class);

    @Bean
    public AuthenticationInformation authenticationInformation(Variables variables) {
        RestClient restClient = RestClient.create();
        String setupUrl = String.format("%s/setup/authentication", variables.kgEndpoint());
        Duration retryInterval = Duration.ofSeconds(variables.coreConnectionRetryInterval());
        int maxAttempts = variables.coreConnectionMaxRetries() + 1;
        for (int attempt = 1; ; attempt++) {
            try {
                return loadAuthenticationInformation(restClient, setupUrl);
            } catch (RestClientException | IllegalStateException e) {
                if (attempt >= maxAttempts) {
                    throw new IllegalStateException(String.format("Was not able to load the authentication information from %s after %d attempts - giving up", setupUrl, attempt), e);
                }
                log.warn("Was not able to load the authentication information from {} (attempt {}/{}): {} - retrying in {}s", setupUrl, attempt, maxAttempts, e.getMessage(), retryInterval.toSeconds());
            }
            try {
                Thread.sleep(retryInterval);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while waiting for the MarmotGraph core to become available", e);
            }
        }
    }

    private AuthenticationInformation loadAuthenticationInformation(RestClient restClient, String setupUrl) {
        log.info("Loading authentication information from {}", setupUrl);
        Map<?, ?> setup = restClient.get().uri(setupUrl).retrieve().body(Map.class);
        if (setup == null || !(setup.get("data") instanceof Map<?, ?> data) || !(data.get("endpoint") instanceof String wellKnownUrl)) {
            throw new IllegalStateException(String.format("The response of %s doesn't contain an OIDC configuration endpoint", setupUrl));
        }
        String loginClientId = data.get("loginClientId") instanceof String clientId ? clientId : null;
        log.info("Loading OIDC configuration from {}", wellKnownUrl);
        Map<?, ?> wellKnown = restClient.get().uri(wellKnownUrl).retrieve().body(Map.class);
        if (wellKnown == null || !(wellKnown.get("authorization_endpoint") instanceof String authorizationEndpoint) || !(wellKnown.get("token_endpoint") instanceof String tokenEndpoint)) {
            throw new IllegalStateException(String.format("The OIDC configuration at %s doesn't contain the authorization and token endpoints", wellKnownUrl));
        }
        return new AuthenticationInformation(authorizationEndpoint, tokenEndpoint, loginClientId);
    }

}
