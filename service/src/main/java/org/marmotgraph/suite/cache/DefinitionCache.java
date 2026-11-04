package org.marmotgraph.suite.cache;

import org.marmotgraph.sdk.MarmotGraphClient;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Caches global (user independent) definitions provided by the core - e.g. of types or spaces - by their identifier.
 * The definitions are shared across all requests. Which of them are listed depends on the user though (since the core
 * only lists those the user has access to), which is why the lists are cached per user. Entries expire after the time
 * to live and are re-fetched on demand - on behalf of the user whose request needs them.
 * <p>
 * Definitions unknown to the core (or not visible to the user) are not cached, so they are looked up again with the
 * next request.
 *
 * @param <D> the type of the cached definitions
 */
public abstract class DefinitionCache<D> {

    private record Entry<D>(D definition, Instant expiresAt) {
    }

    private record Listing<D>(List<D> definitions, Instant expiresAt) {
    }

    private final Map<String, Entry<D>> entries = new ConcurrentHashMap<>();
    private final Map<String, Listing<D>> listings = new ConcurrentHashMap<>();
    private final Duration ttl;
    private final Clock clock;

    protected DefinitionCache(Duration ttl, Clock clock) {
        this.ttl = ttl;
        this.clock = clock;
    }

    /**
     * Fetches the definitions of the given identifiers from the core - unknown ones are omitted.
     */
    protected abstract Map<String, D> fetch(MarmotGraphClient client, List<String> identifiers);

    /**
     * Fetches all definitions from the core by their identifier (in the order to be listed).
     */
    protected abstract Map<String, D> fetchAll(MarmotGraphClient client);

    /**
     * Returns the definitions by the given identifiers - those which are not cached (or expired) are fetched from the
     * core with the given client. Unknown ones are omitted.
     */
    public Map<String, D> get(MarmotGraphClient client, Collection<String> identifiers) {
        Instant now = clock.instant();
        Map<String, D> result = new LinkedHashMap<>();
        List<String> missing = identifiers.stream().distinct().filter(identifier -> {
            Entry<D> entry = entries.get(identifier);
            if (entry != null && entry.expiresAt().isAfter(now)) {
                result.put(identifier, entry.definition());
                return false;
            }
            return true;
        }).toList();
        if (!missing.isEmpty()) {
            Instant expiresAt = now.plus(ttl);
            fetch(client, missing).forEach((identifier, definition) -> {
                entries.put(identifier, new Entry<>(definition, expiresAt));
                result.put(identifier, definition);
            });
        }
        return result;
    }

    /**
     * Returns all definitions listed for the user identified by the given key - if the list is not cached (or
     * expired), it is fetched from the core with the given client (which needs to act on behalf of the same user). The
     * fetched definitions are cached for {@link #get(MarmotGraphClient, Collection)} as well.
     */
    public List<D> list(MarmotGraphClient client, String userKey) {
        Instant now = clock.instant();
        Listing<D> current = listings.get(userKey);
        if (current != null && current.expiresAt().isAfter(now)) {
            return current.definitions();
        }
        // The keys change whenever the token of a user is renewed - expired lists are evicted to not pile them up
        listings.values().removeIf(listing -> !listing.expiresAt().isAfter(now));
        Instant expiresAt = now.plus(ttl);
        Map<String, D> all = fetchAll(client);
        all.forEach((identifier, definition) -> entries.put(identifier, new Entry<>(definition, expiresAt)));
        Listing<D> listing = new Listing<>(List.copyOf(all.values()), expiresAt);
        listings.put(userKey, listing);
        return listing.definitions();
    }

    /**
     * Drops the definition of the given identifier (e.g. after it has been modified) - as well as all lists since they
     * might contain it. Both are fetched from the core again with the next request.
     */
    public void invalidate(String identifier) {
        entries.remove(identifier);
        listings.clear();
    }

    /**
     * Drops all definitions and lists (e.g. after a modification which might affect any of them).
     */
    public void invalidateAll() {
        entries.clear();
        listings.clear();
    }

}
