package org.marmotgraph.suite.types;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.sdk.resources.TypesResource;
import org.marmotgraph.suite.types.TypeCache.TypeDefinition;
import org.mockito.Mockito;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class TypeCacheTest {

    private static final String DEVICE = "https://example.org/types/Device";
    private static final String BUILDING = "https://example.org/types/Building";
    private static final String UNKNOWN = "https://example.org/types/Unknown";
    private static final Duration TTL = Duration.ofMinutes(5);

    private final MutableClock clock = new MutableClock();
    private final TypeCache cache = new TypeCache(TTL, clock);
    private TypesResource types;
    private MarmotGraphClient client;

    @BeforeEach
    void setUp() {
        client = Mockito.mock(MarmotGraphClient.class);
        types = Mockito.mock(TypesResource.class);
        when(client.types()).thenReturn(types);
        when(types.getByNames(any(), any(), any(), anyBoolean(), anyBoolean())).thenAnswer(invocation -> {
            Map<String, TypeInformation> known = Map.of(DEVICE, type(DEVICE, "Device", "#ff9800"), BUILDING, type(BUILDING, "Building", "#4caf50"));
            List<String> names = invocation.getArgument(0);
            return names.stream().filter(known::containsKey).collect(java.util.stream.Collectors.toMap(n -> n, known::get));
        });
    }

    private static TypeInformation type(String identifier, String name, String color) {
        return new TypeInformation(identifier, null, name, color, "http://schema.org/name", null, 42, List.of(), List.of(), List.of(), Map.of());
    }

    @Test
    void cachedTypesAreNotFetchedAgain() {
        Map<String, TypeDefinition> first = cache.get(client, List.of(DEVICE));
        assertEquals(new TypeDefinition(DEVICE, "Device", null, "#ff9800", "http://schema.org/name"), first.get(DEVICE));

        Map<String, TypeDefinition> second = cache.get(client, List.of(DEVICE, BUILDING));
        assertEquals("#ff9800", second.get(DEVICE).color());
        assertEquals("#4caf50", second.get(BUILDING).color());

        verify(types).getByNames(List.of(DEVICE), Stage.IN_PROGRESS, null, false, false);
        verify(types).getByNames(List.of(BUILDING), Stage.IN_PROGRESS, null, false, false);
        verifyNoMoreInteractions(types);
    }

    @Test
    void cacheIsSharedAcrossClients() {
        cache.get(client, List.of(DEVICE));
        MarmotGraphClient otherClient = Mockito.mock(MarmotGraphClient.class);

        assertEquals("Device", cache.get(otherClient, List.of(DEVICE)).get(DEVICE).name());
        Mockito.verifyNoInteractions(otherClient);
    }

    @Test
    void expiredTypesAreFetchedAgain() {
        cache.get(client, List.of(DEVICE));
        clock.advance(TTL);

        cache.get(client, List.of(DEVICE));

        verify(types, Mockito.times(2)).getByNames(List.of(DEVICE), Stage.IN_PROGRESS, null, false, false);
    }

    @Test
    void unknownTypesAreOmittedAndNotCached() {
        assertEquals(Map.of(), cache.get(client, List.of(UNKNOWN)));
        cache.get(client, List.of(UNKNOWN));

        verify(types, Mockito.times(2)).getByNames(List.of(UNKNOWN), Stage.IN_PROGRESS, null, false, false);
    }

    private static class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-10-20T10:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

}
