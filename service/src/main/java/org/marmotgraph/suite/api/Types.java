package org.marmotgraph.suite.api;

import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.marmotgraph.suite.auth.UserKey;
import org.marmotgraph.suite.types.FieldCache;
import org.marmotgraph.suite.types.TypeCache;
import org.marmotgraph.suite.types.TypeCache.TypeDefinition;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Provides the types the user has access to (e.g. to filter the instances by) from the {@link TypeCache} - and the
 * fields of a type from the {@link FieldCache} (e.g. to fill in a new instance).
 */
@AllArgsConstructor
@RestController
@RequestMapping("/types")
public class Types {

    private final TypeCache typeCache;
    private final FieldCache fieldCache;

    @GetMapping
    public List<TypeDefinition> list(@AuthenticatedClient MarmotGraphClient client, @UserKey String userKey) {
        return typeCache.list(client, userKey);
    }

    /**
     * The fields of the type (in the order they are to be shown) - all empty, as for a new instance of it. Empty if
     * the type is unknown.
     *
     * @param type the identifier of the type
     */
    @GetMapping("/fields")
    public List<Instances.Field> fields(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type) {
        return fieldCache.get(client, type).stream().map(d -> Instances.field(d, null, Map.of())).toList();
    }

}
