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

import jakarta.servlet.http.HttpServletRequest;
import org.marmotgraph.suite.commons.controller.CoreController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.security.oauth2.client.AuthorizedClientServiceOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.RemoveAuthorizedClientOAuth2AuthorizationFailureHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.reactive.function.client.ServletOAuth2AuthorizedClientExchangeFilterFunction;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

@Configuration
public class OauthClient {
    private final static String AUTHORIZATION = "Authorization";

    private final static String USER_AUTHORIZATION = "User-Authorization";

    private final ExchangeStrategies exchangeStrategies = ExchangeStrategies.builder()
            .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(1024 * 1000000)).build();

    private final Logger logger = LoggerFactory.getLogger(getClass());

    @Bean
    ClientRegistrationRepository clientRegistrationRepository(CoreController coreController, CommonConfig commonConfig) {
        Map<String, Object> authenticationInformation = coreController.getAuthenticationInformation();
        ClientRegistration registration = ClientRegistration.withRegistrationId("marmotgraph").authorizationUri(authenticationInformation.get("authorization_endpoint").toString()).tokenUri(authenticationInformation.get("token_endpoint").toString()).issuerUri(authenticationInformation.get("issuer").toString()).authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS).clientId(commonConfig.getClientId()).clientSecret(commonConfig.getClientSecret()).build();
        return new InMemoryClientRegistrationRepository(registration);
    }

    @Bean
    @Primary
    @Qualifier("dualAuth")
    WebClient dualAuthWebClient(ClientRegistrationRepository clientRegistrations, OAuth2AuthorizedClientService authorizedClientService, HttpServletRequest request, ConfigurableEnvironment environment) {
        AuthorizedClientServiceOAuth2AuthorizedClientManager clientManager = new AuthorizedClientServiceOAuth2AuthorizedClientManager(clientRegistrations, authorizedClientService);
        ServletOAuth2AuthorizedClientExchangeFilterFunction oauth2 = new ServletOAuth2AuthorizedClientExchangeFilterFunction(clientManager);
        oauth2.setAuthorizationFailureHandler(new RemoveAuthorizedClientOAuth2AuthorizationFailureHandler(
                (clientRegistrationId, principal, attributes) -> {
                    logger.info("Resource server authorization failure for clientRegistrationId={}", clientRegistrationId);
                    authorizedClientService.removeAuthorizedClient(clientRegistrationId, principal.getName());
                })
        );
        oauth2.setDefaultClientRegistrationId("marmotgraph");
        return WebClient.builder().exchangeStrategies(exchangeStrategies).apply(oauth2.oauth2Configuration()).filter((clientRequest, nextFilter) -> {
            ClientRequest updatedHeaders = ClientRequest.from(clientRequest).headers(h -> {
                //Spring adds the oauth2 bearer token to the standard "Authorization" header -> we want it to be sent as
                // "Client-Authorization" though to let the user token be handed in properly.
                h.put("Client-Authorization", h.get(AUTHORIZATION));
                List<String> userAuth = h.get(USER_AUTHORIZATION);
                h.put(AUTHORIZATION, userAuth);
                h.remove(USER_AUTHORIZATION);
            }).build();
            return nextFilter.exchange(updatedHeaders);
        }).defaultRequest(r -> {
            /**
             *  We have to add the user access token to the request here, because this consumer is executed in the original
             *  thread and we therefore have access to the original request. We store it in a temporary header since otherwise
             *  it would be overwritten by the above exchange filter.
             */
            r.header(USER_AUTHORIZATION, request.getHeader(AUTHORIZATION));
        }).build();
    }

    @Bean
    @Qualifier("singleAuth")
    WebClient singleAuth(HttpServletRequest request) {
        return WebClient.builder().exchangeStrategies(exchangeStrategies).defaultRequest(r -> {
            /**
             * We just reuse the original authorization header for the given request and we
             * explicitly don't want a client authorization
             */
            r.header(AUTHORIZATION, request.getHeader(AUTHORIZATION));
        }).build();
    }

}
