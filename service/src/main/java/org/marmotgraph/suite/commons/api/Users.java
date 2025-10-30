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

package org.marmotgraph.suite.commons.api;

import org.marmotgraph.suite.commons.controller.IdController;
import org.marmotgraph.suite.commons.models.CoreResult;
import org.marmotgraph.suite.commons.models.UserProfile;
import org.marmotgraph.suite.commons.service.UserClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RequestMapping("${org.marmotgraph.api.root:}/user")
@RestController
public class Users {

    private final IdController idController;
    private final UserClient userClient;

    public Users(IdController idController, UserClient userClient) {
        this.idController = idController;
        this.userClient = userClient;
    }

    @GetMapping
    public CoreResult<UserProfile> getUserProfile() {
        UserProfile userProfile = userClient.getUserProfile();
        if (userProfile != null) {
            UUID uuid = idController.simplifyFullyQualifiedId(userProfile.getId());
            if (uuid != null) {
                userProfile.setId(uuid.toString());
            }
            return new CoreResult<UserProfile>().setData(userProfile);
        }
        return null;
    }

}
