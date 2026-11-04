package org.marmotgraph.suite.auth;

import io.swagger.v3.oas.annotations.Parameter;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a {@link String} parameter of a controller method to be resolved to a key identifying the user who issued the
 * request (e.g. to cache user specific data by). It is a hash of the bearer token of the request - so it can't be
 * forged without the token itself but changes whenever the token is renewed. Requests without a bearer token are
 * rejected with 401.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Parameter(hidden = true) // Derived from the token which is documented by the global security scheme
public @interface UserKey {
}
