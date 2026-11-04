package org.marmotgraph.suite.api;

import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Functionality;
import org.marmotgraph.sdk.model.UserInfo;
import org.marmotgraph.sdk.model.UserWithRoles;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Forwards the user related requests to the MarmotGraph core - on behalf of the user who issued the request.
 */
@RestController
@RequestMapping("/users")
public class Users {

    @GetMapping("/me")
    public UserInfo me(@AuthenticatedClient MarmotGraphClient client) {
        return client.users().me();
    }

    /**
     * The functionalities the user is granted globally (e.g. TENANT_MANAGEMENT) - those granted for individual spaces or
     * instances only are not included.
     */
    @GetMapping("/me/functionalities")
    public List<String> functionalities(@AuthenticatedClient MarmotGraphClient client) {
        UserWithRoles roles = client.users().myRoles();
        if (roles == null || roles.permissions() == null) {
            return List.of();
        }
        return roles.permissions().stream()
                .filter(p -> p.space() == null && p.id() == null && p.functionality() != null && p.functionality() != Functionality.UNKNOWN)
                .map(p -> p.functionality().name()).distinct().sorted().toList();
    }

}
