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

import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.auth.AuthenticationInformation;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Resolves the OIDC configuration from the (unauthenticated) setup endpoint of the MarmotGraph core.
 * Since the suite can't offer a login without it, the startup is blocked until the core is reachable
 * (or the configured number of retries is exhausted).
 */
@Configuration
public class Authentication {

    @Bean
    public AuthenticationInformation authenticationInformation(Variables variables, MarmotGraphClient client) {
        AuthenticationInformation authenticationInformation = client.setup().discoverAuthentication(
                variables.coreConnectionMaxRetries(), Duration.ofSeconds(variables.coreConnectionRetryInterval()));
        if (authenticationInformation.authorizationEndpoint() == null) {
            throw new IllegalStateException(String.format("The OIDC configuration of the MarmotGraph core at %s doesn't contain an authorization endpoint", client.baseUrl()));
        }
        return authenticationInformation;
    }

}
