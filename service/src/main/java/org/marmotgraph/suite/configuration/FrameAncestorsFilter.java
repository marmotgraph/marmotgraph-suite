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

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * Restricts who may embed the suite in an iframe. An embedded suite reuses the session of the user - without this
 * restriction, any website could show it to a signed in user and trick them into clicking on its actions.
 * <p>
 * The suite itself always may embed its documentation (/docs, see {@link Documentation}) - it shows it in a frame.
 */
@Component
public class FrameAncestorsFilter extends OncePerRequestFilter {

    private static final String SELF = "'self'";
    private static final String NONE = "'none'";

    private final String policy;
    private final String documentationPolicy;

    public FrameAncestorsFilter(@Value("${org.marmotgraph.embedding.frameAncestors}") String frameAncestors) {
        this.policy = "frame-ancestors " + frameAncestors;
        List<String> sources = Arrays.asList(frameAncestors.trim().split("\\s+"));
        if (sources.contains(SELF)) {
            this.documentationPolicy = policy;
        } else if (sources.contains(NONE)) {
            // 'none' doesn't combine with other sources
            this.documentationPolicy = "frame-ancestors " + SELF;
        } else {
            this.documentationPolicy = "frame-ancestors " + SELF + " " + frameAncestors.trim();
        }
    }

    private static boolean isDocumentation(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        String root = "/" + Documentation.ROOT;
        return path.equals(root) || path.startsWith(root + "/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        response.setHeader("Content-Security-Policy", isDocumentation(request) ? documentationPolicy : policy);
        chain.doFilter(request, response);
    }

}
