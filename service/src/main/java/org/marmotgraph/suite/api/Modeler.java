package org.marmotgraph.suite.api;

import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Property;
import org.marmotgraph.sdk.model.PropertySpecification;
import org.marmotgraph.sdk.model.SpaceTypeInformation;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.TargetType;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.sdk.model.TypeSpecification;
import org.marmotgraph.sdk.model.ValidationSchema;
import org.marmotgraph.sdk.resources.TypeListOptions;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.marmotgraph.suite.auth.UserKey;
import org.marmotgraph.suite.spaces.SpaceCache;
import org.marmotgraph.suite.spaces.SpaceCache.SpaceDefinition;
import org.marmotgraph.suite.types.FieldCache;
import org.marmotgraph.suite.types.TypeCache;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Manages the model of the graph - the specifications of the types, their properties (including the relations to other
 * types), their validation schemas and the spaces they are assigned to - on behalf of the user who issued the request
 * (who needs the rights to define types and properties / validation schemas in the core for the modifications).
 * <p>
 * Types and properties are identified by their full name (an IRI) - they are therefore passed as query parameters.
 * Since the editor shows the types and fields as cached by the {@link TypeCache} and {@link FieldCache}, the
 * modified types are dropped from these caches.
 */
@AllArgsConstructor
@RestController
@RequestMapping("/modeler")
public class Modeler {

    /**
     * Space names are used as path segment in the requests to the core - they are therefore restricted to a safe set
     * of characters.
     */
    private static final Pattern SPACE_NAME = Pattern.compile("[\\w.-]+");

    /**
     * A property of a type - as observed in the data, extended by its specification.
     *
     * @param targetTypes the types (full names) the property links to - empty if it is no relation
     */
    public record ModelProperty(String identifier, String name, String nameForReverseLink, String widget, Boolean required,
                                Integer orderNumber, Integer occurrences, List<String> targetTypes) {

        static ModelProperty of(Property property) {
            return new ModelProperty(property.identifier(), property.name(), property.nameForReverseLink(), property.widget(),
                    property.required(), property.orderNumber(), property.occurrences(),
                    property.targetTypes() == null ? List.of() :
                            property.targetTypes().stream().map(TargetType::type).filter(Objects::nonNull).distinct().toList());
        }
    }

    /**
     * A type of the model.
     *
     * @param spaces the spaces the type occurs in
     */
    public record ModelType(String identifier, String name, String description, String color, String labelProperty,
                            boolean embeddedOnly, Integer occurrences, List<ModelProperty> properties, List<String> spaces) {

        static ModelType of(TypeInformation type) {
            return new ModelType(type.identifier(), type.name(), type.description(), type.color(), type.labelProperty(),
                    Boolean.TRUE.equals(type.embeddedOnly()), type.occurrences(),
                    type.properties() == null ? List.of() : type.properties().stream().map(ModelProperty::of)
                            .sorted(Comparator.comparing(ModelProperty::orderNumber, Comparator.nullsLast(Comparator.naturalOrder()))).toList(),
                    type.spaces() == null ? List.of() : type.spaces().stream().map(SpaceTypeInformation::space).filter(Objects::nonNull).toList());
        }
    }

    private final TypeCache typeCache;
    private final FieldCache fieldCache;
    private final SpaceCache spaceCache;

    /**
     * All types the user has access to including their properties (and therefore their relations) - always fetched
     * from the core (not from the cache) since the modeler needs to show the current state.
     */
    @GetMapping("/types")
    public List<ModelType> list(@AuthenticatedClient MarmotGraphClient client) {
        return client.types().list(TypeListOptions.builder().stage(Stage.IN_PROGRESS).withProperties(true).withOccurrenceCount(true).build())
                .allItems().map(ModelType::of).toList();
    }

    /**
     * How far a type is specified.
     *
     * @param specified              if there is a specification for the type - otherwise it is only known from the data
     * @param unspecifiedProperties the number of properties of the type without a specification (neither for the type
     *                              nor globally) - they are only known from the data
     */
    public record SpecificationStatus(boolean specified, int unspecifiedProperties) {
    }

    /**
     * How far the types (of those the user has access to) are specified (by the full name of the type).
     */
    @GetMapping("/types/specificationStatus")
    public Map<String, SpecificationStatus> specificationStatus(@AuthenticatedClient MarmotGraphClient client) {
        Map<String, List<String>> propertiesByType = client.types()
                .list(TypeListOptions.builder().stage(Stage.IN_PROGRESS).withProperties(true).build()).allItems()
                .filter(type -> type.identifier() != null)
                .collect(Collectors.toMap(TypeInformation::identifier,
                        type -> type.properties() == null ? List.of() :
                                type.properties().stream().map(Property::identifier).filter(Objects::nonNull).distinct().toList(),
                        (a, b) -> a, LinkedHashMap::new));
        // The core only provides the specification of one type / property at a time - they are checked concurrently.
        // Properties are often shared by several types - a global specification therefore is looked up only once.
        Set<String> globallySpecified = propertiesByType.values().stream().flatMap(List::stream).distinct().toList().parallelStream()
                .filter(property -> isSpecified(nullIfNotFound(() -> client.properties().get(property).orElse(null))))
                .collect(Collectors.toSet());
        return propertiesByType.entrySet().parallelStream().collect(Collectors.toMap(Map.Entry::getKey, entry -> {
            String type = entry.getKey();
            int unspecified = (int) entry.getValue().stream().filter(property -> !globallySpecified.contains(property))
                    .filter(property -> !isSpecified(nullIfNotFound(() -> client.properties().getForType(property, type).orElse(null))))
                    .count();
            return new SpecificationStatus(specification(client, type) != null, unspecified);
        }));
    }

    /**
     * The specification of the type - null if there is none (yet).
     */
    @GetMapping("/types/specification")
    public TypeSpecification getSpecification(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type) {
        return specification(client, requireType(type));
    }

    /**
     * The specification of the type - null if there is none (the core provides one with null values only if it is
     * empty).
     */
    private static TypeSpecification specification(MarmotGraphClient client, String type) {
        TypeSpecification specification = nullIfNotFound(() -> client.types().getSpecification(type));
        boolean specified = specification != null && (specification.name() != null || specification.description() != null
                || specification.color() != null || specification.labelProperty() != null || specification.embeddedOnly()
                || (specification.searchableProperties() != null && !specification.searchableProperties().isEmpty()));
        return specified ? specification : null;
    }

    /**
     * Creates or replaces the specification of the type - this is how new types are introduced.
     */
    @PutMapping("/types/specification")
    public void defineSpecification(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type,
                                    @RequestBody TypeSpecification specification) {
        client.types().createOrUpdateSpecification(requireType(type), specification);
        invalidate(type);
    }

    @DeleteMapping("/types/specification")
    public void deleteSpecification(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type) {
        client.types().deleteSpecification(requireType(type));
        invalidate(type);
    }

    /**
     * The specification of the property for the type - null if there is none (yet). The values not specified for the
     * type (the core returns null for them - or no specification at all) are taken from the global specification of the
     * property.
     */
    @GetMapping("/types/properties")
    public PropertySpecification getProperty(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type,
                                             @RequestParam String property) {
        requireType(type);
        requireProperty(property);
        PropertySpecification forType = nullIfNotFound(() -> client.properties().getForType(property, type).orElse(null));
        PropertySpecification global = nullIfNotFound(() -> client.properties().get(property).orElse(null));
        return merge(forType, global);
    }

    /**
     * Where the specification of a property comes from.
     */
    public enum SpecificationSource {
        /** The property is specified for the type */
        TYPE,
        /** The property is only specified globally (for all types) */
        GLOBAL,
        /** The property is not specified at all - it is only known from the data */
        NONE
    }

    /**
     * Where the specifications of the properties of the type come from (by the full name of the property).
     */
    @GetMapping("/types/properties/sources")
    public Map<String, SpecificationSource> propertySources(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type) {
        requireType(type);
        TypeInformation information = client.types().getByNames(List.of(type), Stage.IN_PROGRESS, null, true, false).get(type);
        if (information == null || information.properties() == null) {
            return Map.of();
        }
        // The core only provides the specification of one property at a time - they are checked concurrently
        return information.properties().parallelStream().map(Property::identifier).filter(Objects::nonNull).distinct()
                .collect(Collectors.toMap(Function.identity(), property -> source(client, type, property)));
    }

    private static SpecificationSource source(MarmotGraphClient client, String type, String property) {
        if (isSpecified(nullIfNotFound(() -> client.properties().getForType(property, type).orElse(null)))) {
            return SpecificationSource.TYPE;
        }
        if (isSpecified(nullIfNotFound(() -> client.properties().get(property).orElse(null)))) {
            return SpecificationSource.GLOBAL;
        }
        return SpecificationSource.NONE;
    }

    /**
     * The core provides a specification with null values only if it is empty.
     */
    private static boolean isSpecified(PropertySpecification specification) {
        return specification != null && (specification.name() != null || specification.nameForReverseLink() != null
                || (specification.targetTypes() != null && !specification.targetTypes().isEmpty()) || specification.widget() != null
                || specification.readOnly() != null || specification.labelTooltip() != null || specification.required() != null
                || specification.orderNumber() != null);
    }

    /**
     * The specification for the type - with the values it doesn't specify taken from the global one.
     */
    static PropertySpecification merge(PropertySpecification forType, PropertySpecification global) {
        if (forType == null || global == null) {
            return forType != null ? forType : global;
        }
        return new PropertySpecification(
                firstNonNull(forType.name(), global.name()),
                firstNonNull(forType.nameForReverseLink(), global.nameForReverseLink()),
                forType.targetTypes() == null || forType.targetTypes().isEmpty() ? global.targetTypes() : forType.targetTypes(),
                firstNonNull(forType.widget(), global.widget()),
                firstNonNull(forType.readOnly(), global.readOnly()),
                firstNonNull(forType.labelTooltip(), global.labelTooltip()),
                firstNonNull(forType.required(), global.required()),
                firstNonNull(forType.orderNumber(), global.orderNumber()));
    }

    private static <T> T firstNonNull(T value, T fallback) {
        return value != null ? value : fallback;
    }

    /**
     * Adds the property to the type - or replaces its specification. A property with target types is a relation.
     */
    @PutMapping("/types/properties")
    public void defineProperty(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type, @RequestParam String property,
                               @RequestBody PropertySpecification specification) {
        client.properties().defineForType(requireProperty(property), requireType(type), specification);
        invalidate(type);
    }

    @DeleteMapping("/types/properties")
    public void deleteProperty(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type, @RequestParam String property) {
        client.properties().removeForType(requireProperty(property), requireType(type));
        invalidate(type);
    }

    /**
     * The JSON-Schema documents attached to the type (sorted by name).
     */
    @GetMapping("/types/validationSchemas")
    public List<ValidationSchema> listValidationSchemas(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type) {
        return client.types().listValidationSchemas(requireType(type));
    }

    /**
     * Attaches the JSON-Schema document with the given name to the type (replaces an existing one with the same name).
     */
    @PutMapping("/types/validationSchemas/{name}")
    public void defineValidationSchema(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type, @PathVariable String name,
                                       @RequestBody Map<String, Object> schema) {
        client.types().createOrUpdateValidationSchema(requireType(type), requireName(name), schema);
    }

    @DeleteMapping("/types/validationSchemas/{name}")
    public void deleteValidationSchema(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type, @PathVariable String name) {
        client.types().deleteValidationSchema(requireType(type), requireName(name));
    }

    /**
     * The spaces (of those the user has access to) the type is explicitly assigned to.
     */
    @GetMapping("/types/spaces")
    public List<String> assignedSpaces(@AuthenticatedClient MarmotGraphClient client, @UserKey String userKey, @RequestParam String type) {
        requireType(type);
        // The core only allows to check the assignment for one space at a time - they are checked concurrently
        return spaceCache.list(client, userKey).parallelStream().map(SpaceDefinition::identifier)
                .filter(space -> isAssigned(client, space, type)).toList();
    }

    @PutMapping("/types/spaces/{space}")
    public void assignSpace(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type, @PathVariable String space) {
        client.spaces().assignType(requireSpace(space), requireType(type));
    }

    @DeleteMapping("/types/spaces/{space}")
    public void unassignSpace(@AuthenticatedClient MarmotGraphClient client, @RequestParam String type, @PathVariable String space) {
        // A type which is not found in the space isn't part of it anyway
        nullIfNotFound(() -> {
            client.spaces().removeType(requireSpace(space), requireType(type));
            return null;
        });
    }

    /**
     * If the type is assigned to the space - the core reports a type which is not part of the space as not found.
     */
    private static boolean isAssigned(MarmotGraphClient client, String space, String type) {
        return nullIfNotFound(() -> client.spaces().getType(space, type).orElse(null)) != null;
    }

    private void invalidate(String type) {
        typeCache.invalidate(type);
        fieldCache.invalidate(type);
    }

    private static <T> T nullIfNotFound(Supplier<T> lookup) {
        try {
            return lookup.get();
        } catch (MarmotGraphApiException e) {
            if (e.statusCode() == HttpStatus.NOT_FOUND.value()) {
                return null;
            }
            throw e;
        }
    }

    private static String requireType(String type) {
        return requireNotBlank(type, "The type is missing");
    }

    private static String requireProperty(String property) {
        return requireNotBlank(property, "The property is missing");
    }

    private static String requireName(String name) {
        return requireNotBlank(name, "The name of the validation schema is missing");
    }

    private static String requireSpace(String space) {
        if (space == null || !SPACE_NAME.matcher(space).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Space names may only contain letters, digits, \".\", \"-\" and \"_\"");
        }
        return space;
    }

    private static String requireNotBlank(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value;
    }

}
