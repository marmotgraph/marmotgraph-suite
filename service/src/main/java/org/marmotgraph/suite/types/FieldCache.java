package org.marmotgraph.suite.types;

import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Property;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.TargetType;
import org.marmotgraph.suite.cache.DefinitionCache;
import org.marmotgraph.suite.configuration.Variables;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Caches the fields of the types (as shown in the editor) by the full name of the type - derived from the properties
 * of the type as provided by the /types endpoint of the core. Only the user independent parts (widget, order, ...) are
 * kept. This is separate from the {@link TypeCache} since the properties are only needed for the detail view of an
 * instance - and are therefore not fetched when listing the types.
 */
@Component
public class FieldCache extends DefinitionCache<List<FieldCache.FieldDefinition>> {

    /**
     * Properties without an order number are placed after those with one (keeping the order of the core)
     */
    private static final Comparator<FieldDefinition> BY_ORDER = Comparator.comparing(FieldDefinition::order, Comparator.nullsLast(Comparator.naturalOrder()));

    /**
     * The definition of a field of a type.
     *
     * @param identifier  the full name of the property
     * @param targetTypes      the types (full names) the property can link to
     * @param reverseLinkLabel the label of the property when shown from the perspective of the linked instance (e.g.
     *                         "Is language of" for "Language") - null if there is none
     */
    public record FieldDefinition(String identifier, String label, FieldKind kind, Integer order, boolean required, boolean readOnly,
                                  String tooltip, List<String> targetTypes, String reverseLinkLabel) {

        static FieldDefinition of(Property property) {
            return new FieldDefinition(property.identifier(), label(property), FieldKind.ofWidget(property.widget()),
                    property.orderNumber(), Boolean.TRUE.equals(property.required()), Boolean.TRUE.equals(property.readOnly()),
                    property.labelTooltip(),
                    property.targetTypes().stream().map(TargetType::type).filter(Objects::nonNull).toList(),
                    property.nameForReverseLink());
        }

        /**
         * The (capitalized) name of the property - or the last segment of its identifier if there is none.
         */
        private static String label(Property property) {
            String name = property.name();
            if (name == null || name.isBlank()) {
                String identifier = Objects.requireNonNullElse(property.identifier(), "");
                name = identifier.substring(Math.max(identifier.lastIndexOf('/'), identifier.lastIndexOf('#')) + 1);
            }
            return name.isEmpty() ? name : Character.toUpperCase(name.charAt(0)) + name.substring(1);
        }
    }

    @Autowired
    public FieldCache(Variables variables) {
        this(Duration.ofSeconds(variables.typeCacheTtl()), Clock.systemUTC());
    }

    FieldCache(Duration ttl, Clock clock) {
        super(ttl, clock);
    }

    /**
     * The fields of the given type sorted by their order number - empty if the type is unknown.
     */
    public List<FieldDefinition> get(MarmotGraphClient client, String typeName) {
        return get(client, List.of(typeName)).getOrDefault(typeName, List.of());
    }

    @Override
    protected Map<String, List<FieldDefinition>> fetch(MarmotGraphClient client, List<String> typeNames) {
        Map<String, List<FieldDefinition>> result = new LinkedHashMap<>();
        client.types().getByNames(typeNames, Stage.IN_PROGRESS, null, true, false).forEach((name, type) ->
                result.put(name, type.properties().stream().map(FieldDefinition::of).sorted(BY_ORDER).toList()));
        return result;
    }

    /**
     * The fields are only looked up by type - listing them is not supported.
     */
    @Override
    protected Map<String, List<FieldDefinition>> fetchAll(MarmotGraphClient client) {
        throw new UnsupportedOperationException("The fields can only be looked up by type");
    }

}
