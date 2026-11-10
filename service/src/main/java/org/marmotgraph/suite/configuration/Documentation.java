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

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * The documentation below /docs, made of three sites:
 * <ul>
 *     <li>/docs - the documentation of the suite, which the Maven profile "docs" bundles into public/docs. It is served
 *     as static files by {@link SinglePageApplication}.</li>
 *     <li>/docs/core - the documentation of the core, see {@link org.marmotgraph.suite.docs.CoreDocumentation}.</li>
 *     <li>/docs/custom - the documentation of the deployment, built by its operators and provided in a directory
 *     (DOCS_CUSTOM_DIR). Without it, /docs/custom is not found - and the suite's documentation hides its tab.</li>
 * </ul>
 */
@Slf4j
@Configuration
public class Documentation implements WebMvcConfigurer {

    static final String ROOT = "docs";
    static final String CUSTOM_ROOT = ROOT + "/custom";

    private final String customDirectory;

    public Documentation(@Value("${org.marmotgraph.docs.customDirectory:}") String customDirectory) {
        this.customDirectory = customDirectory;
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // The pages link relatively - they only resolve below the trailing slash
        for (String root : new String[]{ROOT, CUSTOM_ROOT}) {
            registry.addRedirectViewController("/" + root, "/" + root + "/");
            registry.addViewController("/" + root + "/").setViewName("forward:/" + root + "/index.html");
        }
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // The more specific pattern wins over the one of the single page application
        if (StringUtils.hasText(customDirectory)) {
            Path directory = Path.of(customDirectory).toAbsolutePath().normalize();
            if (!Files.isDirectory(directory)) {
                log.warn("The documentation of the deployment is configured at {} which is no directory - it is not found until it exists", directory);
            }
            // A location only resolves its files with the trailing slash - the URI of a missing directory comes without
            String location = directory.toUri().toString();
            registry.addResourceHandler("/" + CUSTOM_ROOT + "/**")
                    .addResourceLocations(location.endsWith("/") ? location : location + "/");
        }
    }

}
