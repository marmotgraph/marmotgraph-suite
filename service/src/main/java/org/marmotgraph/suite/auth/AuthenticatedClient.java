package org.marmotgraph.suite.auth;

import io.swagger.v3.oas.annotations.Parameter;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a {@link org.marmotgraph.sdk.MarmotGraphClient} parameter of a controller method to be resolved to a client
 * acting on behalf of the user who issued the request (identified by the bearer token of the request). Requests
 * without a bearer token are rejected with 401.
 * <pre>
 * &#64;GetMapping("/me")
 * public UserInfo me(&#64;AuthenticatedClient MarmotGraphClient client) {
 *     return client.users().me();
 * }
 * </pre>
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Parameter(hidden = true) // The token is documented by the global security scheme - not as a parameter of each endpoint
public @interface AuthenticatedClient {
}
