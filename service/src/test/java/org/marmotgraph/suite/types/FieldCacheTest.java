package org.marmotgraph.suite.types;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Property;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.TargetType;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.sdk.resources.TypesResource;
import org.marmotgraph.suite.types.FieldCache.FieldDefinition;
import org.mockito.Mockito;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FieldCacheTest {

    private static final String DEVICE = "https://example.org/types/Device";
    private static final String UNKNOWN = "https://example.org/types/Unknown";

    private final FieldCache cache = new FieldCache(Duration.ofMinutes(5), Clock.systemUTC());
    private TypesResource types;
    private MarmotGraphClient client;

    @BeforeEach
    void setUp() {
        client = Mockito.mock(MarmotGraphClient.class);
        types = Mockito.mock(TypesResource.class);
        when(client.types()).thenReturn(types);
        when(types.getByNames(any(), any(), any(), anyBoolean(), anyBoolean())).thenReturn(Map.of());
    }

    private static Property property(String identifier, String name, String widget, Integer order, List<TargetType> targetTypes) {
        return property(identifier, name, null, widget, null, null, null, order, targetTypes);
    }

    private static Property property(String identifier, String name, String nameForReverseLink, String widget, Boolean readOnly,
                                     String labelTooltip, Boolean required, Integer order, List<TargetType> targetTypes) {
        return new Property(identifier, name, nameForReverseLink, widget, readOnly, labelTooltip, required, order, 3, targetTypes);
    }

    private static TypeInformation type(List<Property> properties) {
        return new TypeInformation(DEVICE, null, "Device", null, null, null, null, List.of(), properties, List.of());
    }

    @Test
    void propertiesAreMappedToFieldsSortedByTheirOrderNumber() {
        when(types.getByNames(List.of(DEVICE), Stage.IN_PROGRESS, null, true, false)).thenReturn(Map.of(DEVICE, type(List.of(
                property("https://example.org/serialNumber", null, null, null, List.of()),
                property("https://example.org/blades", "blades", "Is blade of", "DynamicTable", null, null, null, 3, List.of(new TargetType("https://example.org/types/Blade", 4, List.of()))),
                property("http://schema.org/name", "name", null, "InputText", true, "The name of the device", true, 1, List.of()),
                property("https://example.org/components", "components", "Nested", 2, List.of())
        ))));

        List<FieldDefinition> fields = cache.get(client, DEVICE);

        assertEquals(List.of(
                new FieldDefinition("http://schema.org/name", "Name", FieldKind.TEXT, 1, true, true, "The name of the device", List.of(), null),
                new FieldDefinition("https://example.org/components", "Components", FieldKind.NESTED, 2, false, false, null, List.of(), null),
                new FieldDefinition("https://example.org/blades", "Blades", FieldKind.LINKS, 3, false, false, null, List.of("https://example.org/types/Blade"), "Is blade of"),
                new FieldDefinition("https://example.org/serialNumber", "SerialNumber", FieldKind.UNSUPPORTED, null, false, false, null, List.of(), null)
        ), fields);
    }

    @Test
    void fieldsAreCached() {
        when(types.getByNames(List.of(DEVICE), Stage.IN_PROGRESS, null, true, false)).thenReturn(Map.of(DEVICE, type(List.of())));

        cache.get(client, DEVICE);
        cache.get(client, DEVICE);

        verify(types).getByNames(List.of(DEVICE), Stage.IN_PROGRESS, null, true, false);
    }

    @Test
    void unknownTypesHaveNoFields() {
        assertEquals(List.of(), cache.get(client, UNKNOWN));
    }

    @Test
    void listingIsNotSupported() {
        assertThrows(UnsupportedOperationException.class, () -> cache.list(client, "alice"));
    }

    @Test
    void widgetsAreMappedToTheKindsOfFields() {
        assertEquals(FieldKind.LINKS, FieldKind.ofWidget("DynamicDropdown"));
        assertEquals(FieldKind.LINK, FieldKind.ofWidget("SimpleDropdown"));
        assertEquals(FieldKind.CHECKBOX, FieldKind.ofWidget("CheckBox"));
        assertEquals(FieldKind.NESTED, FieldKind.ofWidget("Nested"));
        assertEquals(FieldKind.SINGLE_NESTED, FieldKind.ofWidget("SingleNested"));
        assertEquals(FieldKind.UNSUPPORTED, FieldKind.ofWidget(null));
    }

}
