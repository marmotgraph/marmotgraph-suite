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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Resolves the {@link AuthenticatedClient} parameters by deriving a client with the bearer token of the request from
 * the (unauthenticated) {@link MarmotGraphClient} - the derived client shares the connection pool with it. Also
 * resolves the {@link UserKey} parameters by hashing the bearer token.
 */
@AllArgsConstructor
@Component
public class AuthenticatedClientResolver implements HandlerMethodArgumentResolver {

    private static final String BEARER_PREFIX = "Bearer ";

    private final MarmotGraphClient client;

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return (parameter.hasParameterAnnotation(AuthenticatedClient.class) && MarmotGraphClient.class.equals(parameter.getParameterType()))
                || (parameter.hasParameterAnnotation(UserKey.class) && String.class.equals(parameter.getParameterType()));
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer, NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        String token = bearerToken(webRequest.getHeader(HttpHeaders.AUTHORIZATION));
        return parameter.hasParameterAnnotation(UserKey.class) ? userKey(token) : client.withToken(token);
    }

    public static String userKey(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    static String bearerToken(String authorization) {
        String token = authorization != null && authorization.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length()) ? authorization.substring(BEARER_PREFIX.length()).trim() : "";
        if (token.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "A bearer token is required");
        }
        return token;
    }

}
