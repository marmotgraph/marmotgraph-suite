package org.marmotgraph.suite.types;

import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.suite.configuration.Variables;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Caches the definitions of the types (name, color, label property, ...) as provided by the /types endpoint of the
 * core. They are global (not specific to a user), which is why only the user independent parts are kept and shared
 * across all requests. Entries expire after the configured time to live and are re-fetched on demand - on behalf of
 * the user whose request needs them.
 * <p>
 * Types unknown to the core (or not visible to the user) are not cached, so they are looked up again with the next
 * request.
 */
@Component
public class TypeCache {

    /**
     * The global (user independent) parts of the information about a type.
     */
    public record TypeDefinition(String identifier, String name, String description, String color, String labelProperty) {

        static TypeDefinition of(TypeInformation type) {
            return new TypeDefinition(type.identifier(), type.name(), type.description(), type.color(), type.labelProperty());
        }
    }

    private record Entry(TypeDefinition type, Instant expiresAt) {
    }

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final Duration ttl;
    private final Clock clock;

    @Autowired
    public TypeCache(Variables variables) {
        this(Duration.ofSeconds(variables.typeCacheTtl()), Clock.systemUTC());
    }

    TypeCache(Duration ttl, Clock clock) {
        this.ttl = ttl;
        this.clock = clock;
    }

    /**
     * Returns the definitions of the given types by their full name - types which are not cached (or expired) are
     * fetched from the core in one request with the given client. Unknown types are omitted.
     */
    public Map<String, TypeDefinition> get(MarmotGraphClient client, Collection<String> typeNames) {
        Instant now = clock.instant();
        Map<String, TypeDefinition> result = new LinkedHashMap<>();
        List<String> missing = typeNames.stream().distinct().filter(name -> {
            Entry entry = entries.get(name);
            if (entry != null && entry.expiresAt().isAfter(now)) {
                result.put(name, entry.type());
                return false;
            }
            return true;
        }).toList();
        if (!missing.isEmpty()) {
            Instant expiresAt = now.plus(ttl);
            client.types().getByNames(missing, Stage.IN_PROGRESS, null, false, false).forEach((name, type) -> {
                TypeDefinition definition = TypeDefinition.of(type);
                entries.put(name, new Entry(definition, expiresAt));
                result.put(name, definition);
            });
        }
        return result;
    }

}
