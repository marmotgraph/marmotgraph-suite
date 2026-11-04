package org.marmotgraph.suite.types;

import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.sdk.resources.TypeListOptions;
import org.marmotgraph.suite.cache.DefinitionCache;
import org.marmotgraph.suite.configuration.Variables;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Caches the definitions of the types (name, color, label property, ...) as provided by the /types endpoint of the
 * core by their full name. Only the user independent parts are kept.
 */
@Component
public class TypeCache extends DefinitionCache<TypeCache.TypeDefinition> {

    /**
     * The global (user independent) parts of the information about a type.
     */
    public record TypeDefinition(String identifier, String name, String description, String color, String labelProperty) {

        static TypeDefinition of(TypeInformation type) {
            return new TypeDefinition(type.identifier(), type.name(), type.description(), type.color(), type.labelProperty());
        }
    }

    @Autowired
    public TypeCache(Variables variables) {
        this(Duration.ofSeconds(variables.typeCacheTtl()), Clock.systemUTC());
    }

    TypeCache(Duration ttl, Clock clock) {
        super(ttl, clock);
    }

    @Override
    protected Map<String, TypeDefinition> fetch(MarmotGraphClient client, List<String> typeNames) {
        Map<String, TypeDefinition> result = new LinkedHashMap<>();
        client.types().getByNames(typeNames, Stage.IN_PROGRESS, null, false, false).forEach((name, type) -> result.put(name, TypeDefinition.of(type)));
        return result;
    }

    @Override
    protected Map<String, TypeDefinition> fetchAll(MarmotGraphClient client) {
        Map<String, TypeDefinition> result = new LinkedHashMap<>();
        client.types().list(TypeListOptions.builder().stage(Stage.IN_PROGRESS).withOccurrenceCount(false).build()).allItems()
                .forEach(type -> result.put(type.identifier(), TypeDefinition.of(type)));
        return result;
    }

}
