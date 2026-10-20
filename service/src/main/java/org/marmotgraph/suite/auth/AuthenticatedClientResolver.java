package org.marmotgraph.suite.auth;

import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.server.ResponseStatusException;

/**
 * Resolves the {@link AuthenticatedClient} parameters by deriving a client with the bearer token of the request from
 * the (unauthenticated) {@link MarmotGraphClient} - the derived client shares the connection pool with it.
 */
@AllArgsConstructor
@Component
public class AuthenticatedClientResolver implements HandlerMethodArgumentResolver {

    private static final String BEARER_PREFIX = "Bearer ";

    private final MarmotGraphClient client;

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(AuthenticatedClient.class) && MarmotGraphClient.class.equals(parameter.getParameterType());
    }

    @Override
    public MarmotGraphClient resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer, NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        return client.withToken(bearerToken(webRequest.getHeader(HttpHeaders.AUTHORIZATION)));
    }

    static String bearerToken(String authorization) {
        String token = authorization != null && authorization.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length()) ? authorization.substring(BEARER_PREFIX.length()).trim() : "";
        if (token.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "A bearer token is required");
        }
        return token;
    }

}
