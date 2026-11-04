package org.marmotgraph.suite.spaces;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.SpaceInformation;
import org.marmotgraph.sdk.pagination.Page;
import org.marmotgraph.sdk.resources.SpaceListOptions;
import org.marmotgraph.sdk.resources.SpacesResource;
import org.marmotgraph.suite.spaces.SpaceCache.SpaceDefinition;
import org.mockito.Mockito;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class SpaceCacheTest {

    private static final Duration TTL = Duration.ofMinutes(5);

    private final Clock clock = Clock.fixed(Instant.parse("2026-10-20T10:00:00Z"), ZoneOffset.UTC);
    private final SpaceCache cache = new SpaceCache(TTL, clock);
    private SpacesResource spaces;
    private MarmotGraphClient client;

    @BeforeEach
    void setUp() {
        client = Mockito.mock(MarmotGraphClient.class);
        spaces = Mockito.mock(SpacesResource.class);
        when(client.spaces()).thenReturn(spaces);
    }

    @Test
    void listIsCachedWithoutTheUserSpecificPermissions() {
        when(spaces.list(any(SpaceListOptions.class))).thenReturn(new Page<>(List.of(
                new SpaceInformation("myspace", "My Space", List.of("READ")), new SpaceInformation("other", "other", List.of())),
                2, 50, null, null, Map.of(), null));

        List<SpaceDefinition> expected = List.of(new SpaceDefinition("myspace", "My Space"), new SpaceDefinition("other", "other"));
        assertEquals(expected, cache.list(client, "alice"));
        assertEquals(expected, cache.list(client, "alice"));
        assertEquals(Map.of("myspace", expected.getFirst()), cache.get(client, List.of("myspace")));

        verify(spaces).list(any(SpaceListOptions.class));
        verifyNoMoreInteractions(spaces);
    }

    @Test
    void spacesAreFetchedOneByOneAndUnknownOnesAreOmitted() {
        when(spaces.get("myspace")).thenReturn(new SpaceInformation("myspace", "My Space", List.of()));
        when(spaces.get("unknown")).thenThrow(new MarmotGraphApiException(404, "Not found", null, null));

        assertEquals(Map.of("myspace", new SpaceDefinition("myspace", "My Space")), cache.get(client, List.of("myspace", "unknown")));
        cache.get(client, List.of("myspace", "unknown"));

        verify(spaces).get("myspace");
        verify(spaces, Mockito.times(2)).get("unknown");
    }

    @Test
    void otherErrorsOfTheCoreAreForwarded() {
        when(spaces.get("myspace")).thenThrow(new MarmotGraphApiException(403, "Forbidden", null, null));

        assertThrows(MarmotGraphApiException.class, () -> cache.get(client, List.of("myspace")));
    }

}
