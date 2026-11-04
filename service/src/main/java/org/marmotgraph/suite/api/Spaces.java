package org.marmotgraph.suite.api;

import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.marmotgraph.suite.auth.UserKey;
import org.marmotgraph.suite.spaces.SpaceCache;
import org.marmotgraph.suite.spaces.SpaceCache.SpaceDefinition;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Provides the spaces the user has access to (e.g. to filter the instances by) from the {@link SpaceCache}.
 */
@AllArgsConstructor
@RestController
@RequestMapping("/spaces")
public class Spaces {

    private final SpaceCache spaceCache;

    @GetMapping
    public List<SpaceDefinition> list(@AuthenticatedClient MarmotGraphClient client, @UserKey String userKey) {
        return spaceCache.list(client, userKey);
    }

}
