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

package org.marmotgraph.suite.commons.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.marmotgraph.suite.commons.CommonConfig;
import org.marmotgraph.suite.commons.models.FileResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.PathVariable;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.Map;

@Component
public class CoreController {

    public static final String ASSET_CACHE = "assets";
    public static final String AUTHENTICATION_CACHE = "authentication";
    public static final String TENANT_INFORMATION_CACHE = "tenantInformation";

    private final Logger logger = LoggerFactory.getLogger(getClass());
    private final HttpClient httpClient;
    private final CommonConfig commonConfig;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private String dynamicTenant = null;

    public CoreController(CommonConfig commonConfig) {
        this.httpClient = HttpClient.newHttpClient();
        ;
        this.commonConfig = commonConfig;
    }

    @CacheEvict(value = {ASSET_CACHE, AUTHENTICATION_CACHE, TENANT_INFORMATION_CACHE}, allEntries = true)
    public void setTenantDynamically(@PathVariable("tenant") String tenant) {
        this.dynamicTenant = tenant;
    }

    @CachePut(value = ASSET_CACHE, unless = "#result=null")
    public FileResponse refreshAsset(String asset, boolean darkMode) {
        return loadFromCore(buildTenantAssetsUrl(asset, darkMode));
    }

    @Cacheable(value = ASSET_CACHE)
    public FileResponse readAsset(String asset, boolean darkMode) {
        return loadFromCore(buildTenantAssetsUrl(asset, darkMode));
    }

    @Cacheable(value = AUTHENTICATION_CACHE)
    public Map<String, Object> getAuthenticationInformation() {
        try {
            EndpointInformation endpointInformation = getEndpointInformation();
            Map<String, Object> result = new HashMap<>();
            if (endpointInformation != null && endpointInformation.getEndpoint() != null) {
                Map<String, Object> wellKnown = getWellKnown(endpointInformation.getEndpoint());
                if (wellKnown != null) {
                    result.putAll(wellKnown);
                }
            }
            if (endpointInformation != null && endpointInformation.getLoginClientId() != null) {
                result.put("loginClientId", endpointInformation.getLoginClientId());
            }
            return result.isEmpty() ? null : result;
        } catch (URISyntaxException | IOException | InterruptedException e) {
            logger.error("Was not able to read authentication information from core", e);
        }
        return null;
    }

    private Map<String, Object> getWellKnown(String wellKnownUrl) throws URISyntaxException, IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(new URI(wellKnownUrl)).GET().build();
        HttpResponse<InputStream> response = this.httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response != null && response.statusCode() == 200) {
            return objectMapper.readValue(response.body(), Map.class);
        }
        return null;
    }

    private EndpointInformation getEndpointInformation() throws URISyntaxException, IOException, InterruptedException {
        String url = String.format("%s/setup/authentication", buildCoreRootUrl());
        logger.info("Loading authentication information from core ({})", url);
        HttpRequest request = HttpRequest.newBuilder(new URI(url)).GET().build();
        HttpResponse<InputStream> response = this.httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response != null && response.statusCode() == 200) {
            Map<String, Object> resultAsMap = objectMapper.readValue(response.body(), Map.class);
            if (resultAsMap != null) {
                Object data = resultAsMap.get("data");
                if (data instanceof Map) {
                    Object endpoint = ((Map<?, ?>) data).get("endpoint");
                    Object loginClientId = ((Map<?, ?>) data).get("loginClientId");
                    return new EndpointInformation(endpoint instanceof String ? (String) endpoint : null, loginClientId instanceof String ? (String) loginClientId : null);
                }
            }
        }
        return null;
    }

    @Cacheable(value = TENANT_INFORMATION_CACHE)
    public Map<String, Object> getTenantInformation() {
        try {
            String url = buildTenantUrl();
            logger.info("Loading tenant information from core ({})", url);
            HttpResponse<InputStream> response = this.httpClient.send(HttpRequest.newBuilder(new URI(url)).GET().build(), HttpResponse.BodyHandlers.ofInputStream());
            if (response != null && response.statusCode() == 200) {
                return objectMapper.readValue(response.body(), Map.class);
            }
        } catch (URISyntaxException | IOException | InterruptedException e) {
            logger.error("Was not able to read tenant information from core", e);
        }
        return null;
    }

    private String buildCoreRootUrl() {
        return String.format("http%s://%s/%s", commonConfig.getHostName().startsWith("localhost") ? "" : "s", commonConfig.getHostName(), commonConfig.getApiVersion());
    }

    private String buildTenantUrl() {
        return String.format("%s/tenants/%s", buildCoreRootUrl(), dynamicTenant == null ? commonConfig.getTenant() : dynamicTenant);
    }

    private String buildTenantAssetsUrl(String asset, boolean darkMode) {
        return String.format("%s/theme/%s?darkMode=%s", buildTenantUrl(), asset, darkMode);
    }

    private FileResponse loadFromCore(String url) {
        try {
            logger.info("Loading asset {} from core", url);
            HttpRequest request = HttpRequest.newBuilder(new URI(url)).GET().build();
            HttpResponse<byte[]> response = this.httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() == 200) {
                return new FileResponse(response.body(), response.headers().map());
            } else {
                logger.warn("Was not able to load asset {} from core - status code {}", url, response.statusCode());
            }
            return null;
        } catch (URISyntaxException | InterruptedException | IOException e) {
            logger.warn("Was not able to load asset {} from core", url, e);
            return null;
        }
    }

    private final static class EndpointInformation {
        private final String endpoint;
        private final String loginClientId;

        public EndpointInformation(String endpoint, String loginClientId) {
            this.endpoint = endpoint;
            this.loginClientId = loginClientId;
        }

        public String getEndpoint() {
            return endpoint;
        }

        public String getLoginClientId() {
            return loginClientId;
        }
    }

}
