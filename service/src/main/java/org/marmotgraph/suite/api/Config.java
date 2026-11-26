package org.marmotgraph.suite.api;

import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.auth.AuthenticationInformation;
import org.marmotgraph.suite.configuration.CoreConnection;
import org.marmotgraph.suite.configuration.CoreUnavailableException;
import org.marmotgraph.suite.configuration.Variables;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@AllArgsConstructor
@RestController
public class Config {

    private final CoreConnection coreConnection;
    private final Variables variables;
    private final ApiExceptionHandler apiExceptionHandler;

    public record ConfigResponse(String authUrl, String authTokenUrl, String authClientId, String authLogoutUrl, String coreUrl, String tenant, String commit) {
    }

    /** Fails with 503 (see {@link #coreUnavailable}) while the core is unreachable. */
    @GetMapping("/config")
    @SecurityRequirements // publicly accessible - overrides the global security requirement
    public ConfigResponse config() {
        AuthenticationInformation authenticationInformation = coreConnection.verifiedAuthenticationInformation();
        return new ConfigResponse(authenticationInformation.authorizationEndpoint(), authenticationInformation.tokenEndpoint(), authenticationInformation.loginClientId(), authenticationInformation.endSessionEndpoint(), variables.coreUrl(), variables.tenant(), variables.shortCommitId().orElse(null));
    }

    /** The outage page of the UI is shown in the style of the tenant - so the tenant is reported along with the outage. */
    @ExceptionHandler(CoreUnavailableException.class)
    public ResponseEntity<ProblemDetail> coreUnavailable(CoreUnavailableException e) {
        ResponseEntity<ProblemDetail> response = apiExceptionHandler.handle(e);
        response.getBody().setProperty("tenant", variables.tenant());
        return response;
    }

}
