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

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.OAuthFlow;
import io.swagger.v3.oas.models.security.OAuthFlows;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.marmotgraph.sdk.auth.AuthenticationInformation;
import org.springdoc.core.properties.SwaggerUiOAuthProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;


@Configuration
public class OpenAPI {

    private static final String AUTHORIZATION = "Authorization";

    @Bean
    public io.swagger.v3.oas.models.OpenAPI customOpenAPI(AuthenticationInformation authenticationInformation, SwaggerUiOAuthProperties swaggerUiOAuthProperties, Variables variables) {
        swaggerUiOAuthProperties.setClientId(authenticationInformation.loginClientId());
        OAuthFlow oAuthFlow = new OAuthFlow().authorizationUrl(authenticationInformation.authorizationEndpoint()).tokenUrl(authenticationInformation.tokenEndpoint());
        SecurityScheme userToken = new SecurityScheme().name(AUTHORIZATION).type(SecurityScheme.Type.OAUTH2).flows(new OAuthFlows().authorizationCode(oAuthFlow)).description("The user authentication");
        String description = String.format("This is the API of the MarmotGraph Suite (commit %s)", variables.shortCommitId().orElse("unknown"));
        return new io.swagger.v3.oas.models.OpenAPI()
                .info(new Info().title("MarmotGraph Suite API").description(description).license(new License().name("Apache 2.0").url("https://www.apache.org/licenses/LICENSE-2.0.html")))
                .components(new Components().addSecuritySchemes(AUTHORIZATION, userToken))
                .addSecurityItem(new SecurityRequirement().addList(AUTHORIZATION));
    }

}
