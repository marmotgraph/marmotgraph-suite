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

package org.marmotgraph.suite.docs;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.marmotgraph.suite.configuration.Variables;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriUtils;
import org.springframework.web.util.UrlPathHelper;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;

/**
 * Serves the documentation of the core (CORE_ENDPOINT/docs) below /docs/core - on the origin of the suite, so its
 * pages can be linked relatively from the documentation of the suite and embedded in the UI.
 * <p>
 * The pages are static, so they are passed through as they are - caching is left to the browser by forwarding the
 * validators of the core (ETag / Last-Modified).
 */
@Slf4j
@RestController
public class CoreDocumentation {

    static final String ROOT = "/docs/core";

    private static final List<String> FORWARDED_REQUEST_HEADERS = List.of(HttpHeaders.IF_NONE_MATCH, HttpHeaders.IF_MODIFIED_SINCE);
    private static final List<String> FORWARDED_RESPONSE_HEADERS = List.of(HttpHeaders.CONTENT_TYPE, HttpHeaders.CACHE_CONTROL, HttpHeaders.ETAG, HttpHeaders.LAST_MODIFIED, HttpHeaders.EXPIRES);
    private static final Duration TIMEOUT = Duration.ofSeconds(30);

    private final String docsUrl;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    private final UrlPathHelper urlPathHelper = new UrlPathHelper();

    public CoreDocumentation(Variables variables) {
        String coreUrl = variables.coreUrl();
        this.docsUrl = (coreUrl.endsWith("/") ? coreUrl : coreUrl + "/") + "docs/";
    }

    @GetMapping({ROOT, ROOT + "/**"})
    public void get(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = urlPathHelper.getPathWithinApplication(request);
        if (path.equals(ROOT)) {
            // The pages link relatively - they only resolve below the trailing slash
            response.sendRedirect(request.getContextPath() + ROOT + "/");
            return;
        }
        String page = path.substring(ROOT.length() + 1);
        if (page.isEmpty()) {
            page = "index.html";
        }
        if (!isSafe(page)) {
            response.sendError(HttpStatus.NOT_FOUND.value());
            return;
        }
        HttpRequest.Builder coreRequest = HttpRequest.newBuilder(URI.create(docsUrl + UriUtils.encodePath(page, StandardCharsets.UTF_8))).timeout(TIMEOUT).GET();
        FORWARDED_REQUEST_HEADERS.forEach(header -> {
            String value = request.getHeader(header);
            if (value != null) {
                coreRequest.header(header, value);
            }
        });
        HttpResponse<InputStream> coreResponse;
        try {
            coreResponse = httpClient.send(coreRequest.build(), HttpResponse.BodyHandlers.ofInputStream());
        } catch (IOException e) {
            log.warn("Was not able to load the documentation page {} from the core: {}", page, e.getMessage());
            response.sendError(HttpStatus.BAD_GATEWAY.value());
            return;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            response.sendError(HttpStatus.SERVICE_UNAVAILABLE.value());
            return;
        }
        try (InputStream body = coreResponse.body()) {
            int status = coreResponse.statusCode();
            if (status != HttpStatus.OK.value() && status != HttpStatus.NOT_MODIFIED.value()) {
                // A missing page is a broken link, anything else is a problem of the core
                response.sendError(status == HttpStatus.NOT_FOUND.value() ? status : HttpStatus.BAD_GATEWAY.value());
                return;
            }
            response.setStatus(status);
            FORWARDED_RESPONSE_HEADERS.forEach(header -> coreResponse.headers().firstValue(header).ifPresent(value -> response.setHeader(header, value)));
            body.transferTo(response.getOutputStream());
        }
    }

    /**
     * Only pages below the documentation of the core can be requested - no traversal to other endpoints of the core.
     */
    private static boolean isSafe(String page) {
        return !page.startsWith("/") && !page.contains("//") && !page.contains("\\")
                && Arrays.stream(page.split("/")).noneMatch(segment -> segment.equals("..") || segment.equals("."));
    }

}
