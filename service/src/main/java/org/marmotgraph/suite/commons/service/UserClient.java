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

package org.marmotgraph.suite.commons.service;

import org.marmotgraph.suite.commons.models.CoreResult;
import org.marmotgraph.suite.commons.models.UserProfile;
import org.marmotgraph.suite.commons.models.UserRoles;
import org.springframework.stereotype.Component;

@Component
public class UserClient {

    private final ServiceCall kg;

    public UserClient(ServiceCall kg) {
        this.kg = kg;
    }

    public UserProfile getUserProfile() {
        String relativeUrl = "users/me";
        UserFromKG response = kg.client(false).get().uri(kg.url(relativeUrl))
                .retrieve()
                .bodyToMono(UserFromKG.class)
                .block();
        return response != null ? response.getData() : null;
    }

    public UserRoles getUserRoles() {
        String relativeUrl = "users/me/roles";
        UserRolesFromKG response = kg.client(false).get().uri(kg.url(relativeUrl))
                .retrieve()
                .bodyToMono(UserRolesFromKG.class)
                .block();
        return response != null ? response.getData() : null;
    }

    private static class UserFromKG extends CoreResult<UserProfile> {
    }

    private static class UserRolesFromKG extends CoreResult<UserRoles> {
    }


}
