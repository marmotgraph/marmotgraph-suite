package org.marmotgraph.suite.api;

import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.auth.AuthenticationInformation;
import org.marmotgraph.suite.configuration.Variables;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@AllArgsConstructor
@RestController
public class Config {

    private final AuthenticationInformation authenticationInformation;
    private final Variables variables;

    public record ConfigResponse(String authUrl, String authTokenUrl, String authClientId, String authLogoutUrl, String coreUrl, String tenant, String commit) {
    }

    @GetMapping("/config")
    @SecurityRequirements // publicly accessible - overrides the global security requirement
    public ConfigResponse config() {
        return new ConfigResponse(authenticationInformation.authorizationEndpoint(), authenticationInformation.tokenEndpoint(), authenticationInformation.loginClientId(), authenticationInformation.endSessionEndpoint(), variables.coreUrl(), variables.tenant(), variables.shortCommitId().orElse(null));
    }


}
