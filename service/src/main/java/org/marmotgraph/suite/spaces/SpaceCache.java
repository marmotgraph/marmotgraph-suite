package org.marmotgraph.suite.spaces;

import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.SpaceInformation;
import org.marmotgraph.sdk.resources.SpaceListOptions;
import org.marmotgraph.suite.cache.DefinitionCache;
import org.marmotgraph.suite.configuration.Variables;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Caches the definitions of the spaces as provided by the /spaces endpoint of the core by their identifier. Only the
 * user independent parts are kept (e.g. not the permissions of the user in the space).
 */
@Component
public class SpaceCache extends DefinitionCache<SpaceCache.SpaceDefinition> {

    /**
     * The global (user independent) parts of the information about a space.
     */
    public record SpaceDefinition(String identifier, String name) {

        static SpaceDefinition of(SpaceInformation space) {
            return new SpaceDefinition(space.identifier(), space.name());
        }
    }

    @Autowired
    public SpaceCache(Variables variables) {
        this(Duration.ofSeconds(variables.spaceCacheTtl()), Clock.systemUTC());
    }

    SpaceCache(Duration ttl, Clock clock) {
        super(ttl, clock);
    }

    /**
     * The core provides no lookup of multiple spaces at once - they are fetched one by one.
     */
    @Override
    protected Map<String, SpaceDefinition> fetch(MarmotGraphClient client, List<String> identifiers) {
        Map<String, SpaceDefinition> result = new LinkedHashMap<>();
        for (String identifier : identifiers) {
            try {
                result.put(identifier, SpaceDefinition.of(client.spaces().get(identifier)));
            } catch (MarmotGraphApiException e) {
                if (e.statusCode() != HttpStatus.NOT_FOUND.value()) {
                    throw e;
                }
            }
        }
        return result;
    }

    @Override
    protected Map<String, SpaceDefinition> fetchAll(MarmotGraphClient client) {
        Map<String, SpaceDefinition> result = new LinkedHashMap<>();
        client.spaces().list(SpaceListOptions.defaults()).allItems().forEach(space -> result.put(space.identifier(), SpaceDefinition.of(space)));
        return result;
    }

}
