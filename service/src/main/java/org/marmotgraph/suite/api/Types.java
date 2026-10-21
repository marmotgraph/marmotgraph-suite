package org.marmotgraph.suite.api;

import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.marmotgraph.suite.auth.UserKey;
import org.marmotgraph.suite.types.TypeCache;
import org.marmotgraph.suite.types.TypeCache.TypeDefinition;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Provides the types the user has access to (e.g. to filter the instances by) from the {@link TypeCache}.
 */
@AllArgsConstructor
@RestController
@RequestMapping("/types")
public class Types {

    private final TypeCache typeCache;

    @GetMapping
    public List<TypeDefinition> list(@AuthenticatedClient MarmotGraphClient client, @UserKey String userKey) {
        return typeCache.list(client, userKey);
    }

}
