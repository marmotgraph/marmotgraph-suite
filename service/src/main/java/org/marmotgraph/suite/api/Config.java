package org.marmotgraph.suite.api;

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

    public record ConfigResponse(String authUrl, String authTokenUrl, String authClientId, String commit) {
    }

    @GetMapping("/config")
    public ConfigResponse config() {
        return new ConfigResponse(authenticationInformation.authorizationEndpoint(), authenticationInformation.tokenEndpoint(), authenticationInformation.loginClientId(), variables.shortCommitId().orElse(null));
    }


}
