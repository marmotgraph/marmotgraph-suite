package org.marmotgraph.suite.configuration;

import lombok.AllArgsConstructor;
import org.marmotgraph.suite.auth.AuthenticatedClientResolver;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * Registers the custom argument resolvers for the controller methods.
 */
@AllArgsConstructor
@Configuration
public class ArgumentResolvers implements WebMvcConfigurer {

    private final AuthenticatedClientResolver authenticatedClientResolver;

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(authenticatedClientResolver);
    }

}
