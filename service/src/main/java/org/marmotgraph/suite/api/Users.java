package org.marmotgraph.suite.api;

import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.UserInfo;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

}
