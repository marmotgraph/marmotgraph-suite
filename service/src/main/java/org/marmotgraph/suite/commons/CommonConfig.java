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

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
@EnableCaching
@ComponentScan
@EnableAutoConfiguration
@PropertySource({"classpath:common.properties"})
public class CommonConfig {

    private final String tenant;
    private final String hostName;
    private final String apiVersion;
    private final String commit;
    private final String componentName;
    private final String clientId;
    private final String clientSecret;

    public CommonConfig(@Value("${org.marmotgraph.component.name}") String componentName, @Value("${org.marmotgraph.component.clientId}") String clientId, @Value("${org.marmotgraph.component.clientSecret}") String clientSecret, @Value("${org.marmotgraph.tenant:default}") String tenant, @Value("${org.marmotgraph.core.host}") String hostName, @Value("${org.marmotgraph.core.apiVersion:v3}") String apiVersion, @Value("${org.marmotgraph.commit:unknown}") String commit) {
        this.tenant = tenant;
        this.hostName = hostName;
        this.apiVersion = apiVersion;
        this.commit = commit;
        this.componentName = componentName;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    public String getComponentName() {
        return componentName;
    }

    public String getTenant() {
        return tenant;
    }

    public String getHostName() {
        return hostName;
    }

    public String getApiVersion() {
        return apiVersion;
    }

    public String getCommit() {
        return commit;
    }

    public String getClientId() {
        return clientId;
    }

    public String getClientSecret() {
        return clientSecret;
    }
}
