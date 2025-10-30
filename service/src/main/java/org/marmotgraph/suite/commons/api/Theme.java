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

import org.marmotgraph.suite.commons.controller.CoreController;
import org.marmotgraph.suite.commons.models.FileResponse;
import org.marmotgraph.suite.commons.models.ForbiddenException;
import org.marmotgraph.suite.commons.models.UserRoles;
import org.marmotgraph.suite.commons.service.UserClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.util.CollectionUtils;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RequestMapping("${org.marmotgraph.api.root:}/")
@RestController
public class Theme {

    private static final List<String> SUPPORTED_ASSETS = Arrays.asList("favicon", "background", "logo", "css");
    private final CoreController themeController;
    private final Logger logger = LoggerFactory.getLogger(getClass());
    private final UserClient userClient;


    public Theme(CoreController themeController, UserClient userClient) {
        this.themeController = themeController;
        this.userClient = userClient;
    }


    @PutMapping("tenant/{tenant}")
    public void setTenantDynamically(@PathVariable("tenant") String tenant) {
        UserRoles userRoles = userClient.getUserRoles();
        if (userRoles.isGlobalAdmin()) {
            themeController.setTenantDynamically(tenant);
        } else {
            throw new ForbiddenException("You are not allowed to set the tenant since you need to be a global administrator to do so.");
        }
    }


    @GetMapping("theme/{asset}")
    @ResponseBody
    public ResponseEntity<Resource> getAsset(@PathVariable("asset") String asset, @RequestParam(value = "darkMode", required = false) boolean darkMode) {
        if (SUPPORTED_ASSETS.contains(asset.toLowerCase())) {
            FileResponse fileResponse = themeController.readAsset(asset, darkMode);
            if (fileResponse != null) {
                Map<String, List<String>> headers = new HashMap<>(fileResponse.headers());
                Set<String> invalidKeys = headers.keySet().stream().filter(h -> h.startsWith(":")).collect(Collectors.toSet()); //We want to remove HTTP2 headers for now
                invalidKeys.forEach(headers::remove);
                return new ResponseEntity<>(new ByteArrayResource(fileResponse.bytes()), CollectionUtils.toMultiValueMap(headers), HttpStatus.OK);
            }
            return ResponseEntity.notFound().build();
        } else {
            throw new IllegalArgumentException("Unsupported asset: " + asset);
        }
    }


    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(cron = "0 */${org.marmotgraph.suite.commons.assets.cacheRefreshInterval:10} * * * *")
    public void refreshAllCachesAtIntervals() {
        logger.info("Refreshing asset caches...");
        SUPPORTED_ASSETS.forEach(asset -> {
                    themeController.refreshAsset(asset, true);
                    themeController.refreshAsset(asset, false);

                }
        );
    }

}
