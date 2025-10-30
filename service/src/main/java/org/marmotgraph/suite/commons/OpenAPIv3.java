/*
 * Copyright 2018 - 2021 Swiss Federal Institute of Technology Lausanne (EPFL)
 * Copyright 2021 - 2024 EBRAINS AISBL
 * Copyright 2024 - 2025 ETH Zurich
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
package org.marmotgraph.suite.commons;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.OAuthFlow;
import io.swagger.v3.oas.models.security.OAuthFlows;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.marmotgraph.suite.commons.controller.CoreController;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.Collections;
import java.util.Map;

@Configuration
public class OpenAPIv3 {

    @Bean
    public OpenAPI customOpenAPI(CoreController coreController, CommonConfig commonConfig, ConfigurableEnvironment environment) {
        Map<String, Object> authenticationInformation = coreController.getAuthenticationInformation();
        Map<String, Object> tenantInformation = coreController.getTenantInformation();
        if (!environment.getPropertySources().contains("dynamicProperties")) {
            environment.getPropertySources().addFirst(new MapPropertySource("dynamicProperties", Map.of("springdoc.swagger-ui.oauth.client-id", authenticationInformation.get("loginClientId"))));
        }
        OAuthFlow oAuthFlow = new OAuthFlow();
        oAuthFlow.authorizationUrl(authenticationInformation.get("authorization_endpoint").toString());
        SecurityScheme userToken = new SecurityScheme().name("Authorization").type(SecurityScheme.Type.OAUTH2).flows(new OAuthFlows().authorizationCode(oAuthFlow)).description("The user authentication");
        SecurityRequirement userWithoutClientReq = new SecurityRequirement().addList("Authorization");

        OpenAPI openapi = new OpenAPI().openapi("3.0.3");
        String componentName = String.format("%s %s", tenantInformation.get("title"), commonConfig.getComponentName());
        String description = String.format("This is the API of the %s (commit %s)", componentName, commonConfig.getCommit());

        return openapi.info(new Info().version("v3.0.0").title(String.format("This is the %s API", componentName)).description(description).license(new License().name("Apache 2.0").url("https://www.apache.org/licenses/LICENSE-2.0.html")).termsOfService("https://kg.ebrains.eu/search-terms-of-use.html"))
                .components(new Components()).schemaRequirement("Authorization", userToken)
                .security(Collections.singletonList(userWithoutClientReq));
    }


}
