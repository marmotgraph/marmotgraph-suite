package org.marmotgraph.suite.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.InstanceSortBy;
import org.marmotgraph.sdk.model.InstanceTimestamps;
import org.marmotgraph.sdk.model.LinkingInstance;
import org.marmotgraph.sdk.model.ReleaseStatus;
import org.marmotgraph.sdk.model.Functionality;
import org.marmotgraph.sdk.model.ReleaseTreeScope;
import org.marmotgraph.sdk.model.SchemaValidationResult;
import org.marmotgraph.sdk.model.ValidationError;
import org.marmotgraph.sdk.model.Scope;
import org.marmotgraph.sdk.model.SortDirection;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.pagination.Page;
import org.marmotgraph.sdk.resources.InstanceListOptions;
import org.marmotgraph.sdk.resources.ResponseOptions;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.marmotgraph.suite.types.FieldCache;
import org.marmotgraph.suite.types.FieldCache.FieldDefinition;
import org.marmotgraph.suite.types.FieldKind;
import org.marmotgraph.suite.types.TypeCache;
import org.marmotgraph.suite.types.TypeCache.TypeDefinition;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Provides the instances shown in the editor by listing / fetching them from the MarmotGraph core - on behalf of the user who
 * issued the request. The type information (name, description, color, label property) is taken from the {@link TypeCache}.
 * <p>
 * TODO the last visit is not (yet) provided by the core - it is always reported as never visited. Only the first page of instances is returned (together with the total number of instances).
 */
@AllArgsConstructor
@RestController
@RequestMapping("/instances")
public class Instances {

    /**
     * Whether a link could be resolved by the core - and if so, whether the user is allowed to read its target.
     */
    public enum LinkStatus {
        /** The target is known and readable - all information is available */
        @JsonProperty("resolved") RESOLVED,
        /** The target is known but not readable by the user - only its id and type are available */
        @JsonProperty("restricted") RESTRICTED,
        /** The link doesn't point to any known instance - only the identifier it is linked with is available */
        @JsonProperty("unresolved") UNRESOLVED;

        static LinkStatus of(String value) {
            return Arrays.stream(values()).filter(s -> s.name().equalsIgnoreCase(value)).findFirst().orElse(UNRESOLVED);
        }
    }

    /**
     * An instance linked from another one. The instanceId is the id of the target in the core - except for unresolved
     * links for which it is the identifier the target is linked with. The name falls back to the instanceId if the
     * label of the target is not available. hasDirectLinks / hasReverseLinks tell whether the target has outgoing /
     * incoming links itself (unknown if the target is not readable).
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LinkedInstance(String instanceId, String instanceName, String type, String typeColor, String space, String fieldLabel,
                                 Boolean hasDirectLinks, Boolean hasReverseLinks, LinkStatus linkStatus) {

        LinkedInstance withFieldLabel(String label) {
            return new LinkedInstance(instanceId, instanceName, type, typeColor, space, label, hasDirectLinks, hasReverseLinks, linkStatus);
        }
    }

    /**
     * The outcome of the last validation of an instance against one of the validation schemas of its type - the
     * compliance is the share of the properties declared by the schema which the instance fulfills (in percent, unknown
     * for results stored before the score was introduced).
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Validation(String name, boolean valid, Double compliance, List<ValidationIssue> errors) {

        /** The outcome without its errors - as listed in the overview. */
        static Validation of(SchemaValidationResult result) {
            return new Validation(result.name(), result.valid(), result.compliance(), null);
        }

        /** The outcome with its errors - attributed to the given fields of the instance where possible. */
        static Validation of(SchemaValidationResult result, List<Field> fields) {
            List<ValidationError> errors = Objects.requireNonNullElse(result.errors(), List.of());
            return new Validation(result.name(), result.valid(), result.compliance(), errors.stream().map(e -> ValidationIssue.of(e, fields)).toList());
        }
    }

    /**
     * A violation reported by a validation schema - the field is the identifier of the field it concerns (null if it
     * concerns the instance as a whole or a property which is no field of the type). The identifiers of the fields
     * mentioned in the message are replaced by their labels.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ValidationIssue(String field, String keyword, String message) {

        static ValidationIssue of(ValidationError error, List<Field> fields) {
            Field field = validationErrorField(error, fields);
            String message = Objects.requireNonNullElse(error.message(), Objects.requireNonNullElse(error.keyword(), ""));
            for (Field f : fields) {
                message = message.replace("'" + f.identifier() + "'", "'" + f.label() + "'");
            }
            return new ValidationIssue(field != null ? field.identifier() : null, error.keyword(), message);
        }
    }

    /**
     * The condensed representation of an instance as listed in the overview of the editor - including the results of
     * its last validation per validation schema (empty if its type has none).
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record InstanceSummary(int id, String instanceId, String type, String typeDescription, String typeColor, String instanceName, String space,
                           String permissions, boolean favorite, boolean contributed, String lastModified, String releaseStatus, List<Validation> validation) {
    }

    /**
     * The first page of the instances listed in the overview - the total is the number of instances matching the query
     * as reported by the core (unknown if not reported).
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record InstanceList(List<InstanceSummary> instances, Integer total) {
    }

    /**
     * A field of an instance as shown in the editor - the value is provided in the shape required by the kind of the
     * field (see {@link #fieldValue(FieldKind, Object, Map)}).
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Field(String identifier, String label, FieldKind kind, Object value, boolean required, boolean readOnly,
                        String tooltip, List<String> targetTypes) {
    }

    /**
     * The representation of a single instance as shown in its detail view - its fields are sorted in the order they are
     * to be shown in. The direct links are the instances linked by its fields (labeled with the field they are linked
     * by, in the order of the fields). The incoming links are provided separately (see {@link #incomingLinks}) since they are paginated.
     * The validation holds the results of the last validation per validation schema of the type - with their errors.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record InstanceDetail(String instanceId, String type, String typeDescription, String typeColor, String instanceName,
                                 String space, String permissions, String releaseStatus, List<Field> fields,
                                 List<LinkedInstance> directLinks, List<Validation> validation) {
    }

    /**
     * An instance linking to another one - its type is given by the group it is listed in (see
     * {@link IncomingLinksOfType}). The name falls back to the instanceId if the label is not available (e.g. because
     * the instance is restricted). hasDirectLinks / hasReverseLinks tell whether the instance has outgoing / incoming
     * links itself (unknown if the instance is restricted).
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record IncomingLink(String instanceId, String instanceName, String space, Boolean hasDirectLinks, Boolean hasReverseLinks,
                               LinkStatus linkStatus) {
    }

    /**
     * The instances of a type linking to an instance - one page of them. If there are more, they can be loaded with the
     * nextMarker (it identifies the group as well).
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record IncomingLinksOfType(String typeIdentifier, String type, String typeColor, List<IncomingLink> links, Integer total,
                                      String nextMarker) {
    }

    /**
     * The instances linking to an instance by a property - grouped by their type. The label describes the property from
     * the perspective of the linked instance (e.g. "Is language of") - it falls back to the name of the property.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record IncomingLinks(String property, String label, List<IncomingLinksOfType> types) {
    }

    /**
     * An instance of the release tree of another one (the scope of its type evaluated for it) - with the instances
     * reached from it. The release status is the one of the instance itself (not of its children). canRelease /
     * canUnrelease tell whether the user is allowed to release / unrelease the instance. The name falls back to the
     * instanceId if the instance has no label.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ReleaseNode(String instanceId, String instanceName, String type, String typeColor, String space,
                              String releaseStatus, boolean canRelease, boolean canUnrelease, List<ReleaseNode> children) {
    }

    /**
     * The administrative information of an instance - when it was created, last modified and (first / last) released
     * (ISO-8601, null if unknown or never released) and the users who have contributed to it.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record InstanceInformation(String createdAt, String lastModified, String firstReleased, String lastReleased,
                                      List<Contributor> contributors) {
    }

    /**
     * A user who has contributed to an instance - the name falls back to the username if it is not known.
     */
    public record Contributor(String username, String name) {
    }

    /**
     * The properties added to each link by the core if a summary of the outgoing links is requested.
     */
    static final String LINK_STATUS = "_linkStatus";
    static final String LINK_RESOLVED_ID = "_resolvedId";
    static final String LINK_LABEL = "_label";
    static final String LINK_SPACE = "_space";
    static final String LINK_HAS_OUTGOING_LINKS = "_hasOutgoingLinks";

    private static final String RELEASED = "released";
    private static final String HAS_CHANGED = "has changed";
    private static final String IN_PROGRESS = "in progress";
    /** The alias of the core for the private space of the user */
    private static final String PRIVATE_SPACE = "myspace";

    /**
     * The functionalities of the core translated to the permissions shown in the editor (in the order of display).
     */
    private static final Map<String, String> PERMISSION_LABELS = new LinkedHashMap<>();

    static {
        PERMISSION_LABELS.put("READ", "View");
        PERMISSION_LABELS.put("WRITE", "Edit");
        PERMISSION_LABELS.put("INVITE_FOR_REVIEW", "Review");
        PERMISSION_LABELS.put("RELEASE", "Release");
    }

    private final TypeCache typeCache;
    private final FieldCache fieldCache;

    /**
     * @param search      an optional term the instances are filtered by (matched against their labels by the core)
     * @param typeFilter  optional types (IRIs) the instances are restricted to - instances of any of them are returned
     * @param spaceFilter optional spaces the instances are restricted to - instances in any of them are returned
     * @param favorites   whether the instances are restricted to the favorites of the user
     * @param contributed whether the instances are restricted to those the user has contributed to
     * @param sortBy        the attribute the instances are sorted by (by name if not specified)
     * @param sortDirection the direction of the sorting (ascending if not specified)
     */
    @GetMapping
    public InstanceList list(@AuthenticatedClient MarmotGraphClient client, @RequestParam(required = false) String search,
                               @RequestParam(name = "type", required = false) List<String> typeFilter,
                               @RequestParam(name = "space", required = false) List<String> spaceFilter,
                               @RequestParam(defaultValue = "false") boolean favorites,
                               @RequestParam(defaultValue = "false") boolean contributed,
                               @RequestParam(required = false) InstanceSortBy sortBy,
                               @RequestParam(required = false) SortDirection sortDirection) {
        Page<org.marmotgraph.sdk.model.Instance> page = client.instances().list(InstanceListOptions.builder()
                .stage(Stage.IN_PROGRESS)
                .types(nonBlank(typeFilter))
                .spaces(nonBlank(spaceFilter))
                .searchByLabel(search != null && !search.isBlank() ? search.trim() : null)
                .favoritesOnly(favorites)
                .withContribution(contributed)
                .sortBy(sortBy)
                .sortDirection(sortDirection)
                .responseOptions(ResponseOptions.builder().returnPermissions(true).returnValidationResults(true).returnReleaseStatus(true)
                        .returnFavorite(true).returnHasContributed(true).returnTimestamps(true).build())
                .build());
        List<org.marmotgraph.sdk.model.Instance> instances = page.items();
        if (instances.isEmpty()) {
            return new InstanceList(List.of(), page.total());
        }
        List<String> typeNames = instances.stream().map(org.marmotgraph.sdk.model.Instance::getType).filter(Objects::nonNull).distinct().toList();
        Map<String, TypeDefinition> types = typeNames.isEmpty() ? Map.of() : typeCache.get(client, typeNames);

        List<InstanceSummary> result = new ArrayList<>(instances.size());
        for (org.marmotgraph.sdk.model.Instance instance : instances) {
            String instanceId = instance.getUuid().map(UUID::toString).orElse(instance.getId());
            String typeName = instance.getType();
            TypeDefinition type = typeName != null ? types.get(typeName) : null;
            result.add(new InstanceSummary(result.size() + 1, instanceId, typeLabel(typeName, type), type != null ? type.description() : null, type != null ? type.color() : null,
                    instanceName(instance, type, instanceId), instance.getSpace(),
                    permissions(instance.getPermissions()), Boolean.TRUE.equals(instance.isFavorite()),
                    Boolean.TRUE.equals(instance.hasContributed()), lastModified(instance.getTimestamps()),
                    releaseStatus(instance.getReleaseStatus()),
                    instance.getValidation().stream().map(Validation::of).toList()));
        }
        return new InstanceList(result, page.total());
    }

    /**
     * @param id the uuid of the instance as known by the core
     */
    @GetMapping("/{id}")
    public InstanceDetail get(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        org.marmotgraph.sdk.model.Instance instance = client.instances().get(id, Stage.IN_PROGRESS,
                ResponseOptions.builder().returnPermissions(true).returnSummaryOfOutgoingLinks(true).returnValidationResults(true).build());
        String instanceId = instance.getUuid().map(UUID::toString).orElse(id.toString());
        String typeName = instance.getType();
        TypeDefinition type = typeName != null ? typeCache.get(client, List.of(typeName)).get(typeName) : null;
        ReleaseStatus releaseStatus = client.instances().releaseStatus(id, ReleaseTreeScope.TOP_INSTANCE_ONLY);
        List<Field> fields = fields(client, instance, typeName);
        return new InstanceDetail(instanceId, typeLabel(typeName, type), type != null ? type.description() : null, type != null ? type.color() : null,
                instanceName(instance, type, instanceId), instance.getSpace(), permissions(instance.getPermissions()),
                releaseStatus(releaseStatus), fields, directLinks(fields),
                instance.getValidation().stream().map(v -> Validation.of(v, fields)).toList());
    }

    /**
     * The field a validation error concerns: the property its location starts with - or, for an error of the instance
     * itself (e.g. a missing "required" property), the property named in its message. Null if there is none.
     */
    static Field validationErrorField(ValidationError error, List<Field> fields) {
        List<Object> location = Objects.requireNonNullElse(error.instanceLocation(), List.of());
        if (!location.isEmpty()) {
            return location.getFirst() instanceof String property ? fields.stream().filter(f -> f.identifier().equals(property)).findFirst().orElse(null) : null;
        }
        String message = Objects.requireNonNullElse(error.message(), "");
        return fields.stream().filter(f -> message.contains("'" + f.identifier() + "'")).findFirst().orElse(null);
    }

    /**
     * Updates the given fields of the instance (as edited in the editor) - the other properties are kept as they are.
     * The values are expected in the shape of the kind of their field (see {@link #fieldValue(FieldKind, Object, Map)})
     * and are translated back to JSON-LD. The core rejects the request if the user is not allowed to edit the instance.
     *
     * @param id      the uuid of the instance as known by the core
     * @param changes the changed fields - by their identifier
     * @return the instance as stored by the core
     */
    @PatchMapping("/{id}")
    public InstanceDetail update(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id,
                                 @RequestBody Map<String, Object> changes) {
        String typeName = client.instances().get(id, Stage.IN_PROGRESS, ResponseOptions.DEFAULT).getType();
        Map<String, Object> payload = jsonLdPayload(client, typeName, changes);
        if (!payload.isEmpty()) {
            client.instances().update(id, payload);
        }
        return get(client, id);
    }

    /**
     * A new instance as created in the editor - the values of its fields (by their identifier) are expected in the
     * shape of the kind of their field. The space falls back to the private space of the user if none is given.
     */
    public record NewInstance(String type, String space, Map<String, Object> fields) {
    }

    /**
     * Creates the instance with the given (client generated) id - with the values of its fields translated back to
     * JSON-LD (empty fields are left out). The core rejects the request if the id is already in use or the user is not
     * allowed to create instances in the space.
     *
     * @param id the uuid the instance is created with
     * @return the instance as stored by the core
     */
    @PostMapping("/{id}")
    public InstanceDetail create(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id,
                                 @RequestBody NewInstance instance) {
        if (instance.type() == null || instance.type().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The type of the instance is missing");
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("@type", List.of(instance.type()));
        jsonLdPayload(client, instance.type(), Objects.requireNonNullElse(instance.fields(), Map.of())).forEach((identifier, value) -> {
            if (value != null) {
                payload.put(identifier, value);
            }
        });
        String space = instance.space() != null && !instance.space().isBlank() ? instance.space() : PRIVATE_SPACE;
        client.instances().createWithId(id, space, payload);
        return get(client, id);
    }

    /**
     * Translates the values of the fields of the type (by their identifier, in the shape of the kind of their field)
     * into the JSON-LD values of their properties - rejects fields which are unknown or can't be edited.
     */
    private Map<String, Object> jsonLdPayload(MarmotGraphClient client, String typeName, Map<String, Object> values) {
        Map<String, FieldDefinition> definitions = (typeName != null ? fieldCache.get(client, typeName) : List.<FieldDefinition>of())
                .stream().collect(Collectors.toMap(FieldDefinition::identifier, d -> d, (a, b) -> a));
        Map<String, Object> payload = new LinkedHashMap<>();
        values.forEach((identifier, value) -> {
            FieldDefinition definition = definitions.get(identifier);
            if (definition == null || definition.readOnly()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.format("The field \"%s\" can't be edited", identifier));
            }
            payload.put(identifier, jsonLdValue(definition.kind(), value));
        });
        return payload;
    }

    /**
     * Translates the value of a field (in the shape required by its kind) back into JSON-LD - the linked instances are
     * referenced by their id. Empty values are sent as null so they are removed.
     */
    static Object jsonLdValue(FieldKind kind, Object value) {
        if (value == null || value instanceof String s && s.isBlank()) {
            return null;
        }
        return switch (kind) {
            case LINK -> reference(value);
            case LINKS -> {
                List<Map<String, Object>> references = values(value).stream().map(Instances::reference).filter(Objects::nonNull).toList();
                yield references.isEmpty() ? null : references;
            }
            default -> value;
        };
    }

    /**
     * A reference to a linked instance (as provided by {@link #linkedInstance(Object, Map)}) - null if the value is no
     * linked instance.
     */
    private static Map<String, Object> reference(Object linkedInstance) {
        String id = linkedInstance instanceof Map<?, ?> link ? firstString(link.get("instanceId")) : null;
        return id != null && !id.isBlank() ? Map.of("@id", id) : null;
    }

    /**
     * The release status of an instance as shown in the editor - an unknown status is treated as not released.
     */
    private static String releaseStatus(ReleaseStatus releaseStatus) {
        if (releaseStatus == ReleaseStatus.RELEASED) {
            return RELEASED;
        }
        return releaseStatus == ReleaseStatus.HAS_CHANGED ? HAS_CHANGED : IN_PROGRESS;
    }

    /**
     * The release tree of the instance: the instance and the instances reached from it by the scopes of its type (the
     * combination of all of them) - with their release status and the permissions of the user to release them.
     * Instances the user can't read are left out by the core (together with the instances reached through them).
     *
     * @param id the uuid of the instance as known by the core
     */
    @GetMapping("/{id}/scope")
    public ReleaseNode scope(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        Scope scope = client.instances().scope(id, null, Stage.IN_PROGRESS, true, true);
        Set<String> typeNames = new LinkedHashSet<>();
        collectTypes(scope, typeNames);
        Map<String, TypeDefinition> types = typeNames.isEmpty() ? Map.of() : typeCache.get(client, List.copyOf(typeNames));
        return releaseNode(scope, types);
    }

    private static void collectTypes(Scope scope, Set<String> typeNames) {
        if (scope.type() != null) {
            typeNames.add(scope.type());
        }
        scope.children().forEach(child -> collectTypes(child, typeNames));
    }

    private static ReleaseNode releaseNode(Scope scope, Map<String, TypeDefinition> types) {
        String instanceId = Objects.toString(scope.id(), "");
        TypeDefinition type = scope.type() != null ? types.get(scope.type()) : null;
        String label = scope.label() != null && !scope.label().isBlank() ? scope.label() : instanceId;
        return new ReleaseNode(instanceId, label, typeLabel(scope.type(), type), type != null ? type.color() : null,
                scope.space(), releaseStatus(scope.releaseStatus()),
                scope.permissions().contains(Functionality.RELEASE.name()), scope.permissions().contains(Functionality.UNRELEASE.name()),
                scope.children().stream().map(child -> releaseNode(child, types)).toList());
    }

    /**
     * Releases the current state of the instance - the core rejects the request if the user is not allowed to.
     *
     * @param id the uuid of the instance as known by the core
     */
    @PutMapping("/{id}/release")
    public void release(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        client.instances().release(id);
    }

    /**
     * The administrative information of the instance (timestamps and contributors) - as shown in its info view.
     *
     * @param id the uuid of the instance as known by the core
     */
    @GetMapping("/{id}/info")
    public InstanceInformation info(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        org.marmotgraph.sdk.model.Instance instance = client.instances().get(id, Stage.IN_PROGRESS,
                ResponseOptions.builder().returnTimestamps(true).returnContributors(true).build());
        InstanceTimestamps timestamps = instance.getTimestamps();
        List<Contributor> contributors = instance.getContributors().stream()
                .map(c -> new Contributor(c.username(), c.name() != null && !c.name().isBlank() ? c.name() : c.username()))
                .toList();
        return timestamps == null ? new InstanceInformation(null, null, null, null, contributors)
                : new InstanceInformation(isoString(timestamps.createdAt()), isoString(timestamps.lastUpdateAt()),
                isoString(timestamps.firstReleaseAt()), isoString(timestamps.lastReleaseAt()), contributors);
    }

    /** The last update of the instance (in progress) - null if it isn't known */
    private static String lastModified(InstanceTimestamps timestamps) {
        return timestamps != null ? isoString(timestamps.lastUpdateAt()) : null;
    }

    private static String isoString(Instant instant) {
        return instant != null ? instant.toString() : null;
    }

    /**
     * Flags the instance as favorite of the user - a no-op if it already is one.
     *
     * @param id the uuid of the instance as known by the core
     */
    @PutMapping("/{id}/favorite")
    public void addFavorite(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        client.instances().addFavorite(id);
    }

    /**
     * Removes the favorite flag of the user from the instance - a no-op if it isn't one.
     *
     * @param id the uuid of the instance as known by the core
     */
    @DeleteMapping("/{id}/favorite")
    public void removeFavorite(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        client.instances().removeFavorite(id);
    }

    /**
     * Removes the released version of the instance - the core rejects the request if the user is not allowed to.
     *
     * @param id the uuid of the instance as known by the core
     */
    @DeleteMapping("/{id}/release")
    public void unrelease(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        client.instances().unrelease(id);
    }

    /**
     * The instance as provided by the core (the full JSON-LD document without the internal properties) - for the raw
     * view of the editor.
     *
     * @param id the uuid of the instance as known by the core
     */
    @GetMapping("/{id}/raw")
    public Map<String, Object> getRaw(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        return withoutInternalProperties(client.instances().get(id, Stage.IN_PROGRESS, ResponseOptions.DEFAULT));
    }

    /**
     * Replaces the instance by the given JSON-LD document (as edited in the raw view of the editor) - the core rejects
     * the request if the user is not allowed to edit the instance.
     *
     * @param id the uuid of the instance as known by the core
     * @return the instance as stored by the core (without the internal properties)
     */
    @PutMapping("/{id}/raw")
    public Map<String, Object> replaceRaw(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id,
                                          @RequestBody Map<String, Object> payload) {
        return withoutInternalProperties(client.instances().replace(id, payload));
    }

    /**
     * Removes the internal properties of the core (prefixed with "_", e.g. _space or _permissions) - they are not part
     * of the payload of the instance.
     */
    private static Map<String, Object> withoutInternalProperties(Map<String, Object> instance) {
        Map<String, Object> result = new LinkedHashMap<>(instance);
        result.keySet().removeIf(key -> key.startsWith("_"));
        return result;
    }

    /**
     * The instances linking to the given one - grouped by the property they link with and their type (in the order of
     * the core). Every group is paginated on its own: if a marker (the nextMarker of a group) is given, only the
     * following page of this group is returned.
     *
     * @param id the uuid of the instance as known by the core
     */
    @GetMapping("/{id}/incomingLinks")
    public List<IncomingLinks> incomingLinks(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id,
                                             @RequestParam(defaultValue = "10") int size, @RequestParam(required = false) String marker) {
        Map<String, Map<String, Page<LinkingInstance>>> byProperty = client.instances().incomingLinks(id, null, null, Stage.IN_PROGRESS,
                marker != null && !marker.isBlank() ? marker : null, size, true);
        if (byProperty.isEmpty()) {
            return List.of();
        }
        List<String> typeNames = byProperty.values().stream().flatMap(byType -> byType.keySet().stream()).distinct().toList();
        Map<String, TypeDefinition> types = typeCache.get(client, typeNames);
        Map<String, List<FieldDefinition>> fields = fieldCache.get(client, typeNames);

        List<IncomingLinks> result = new ArrayList<>(byProperty.size());
        byProperty.forEach((property, byType) -> {
            List<IncomingLinksOfType> groups = new ArrayList<>();
            byType.forEach((typeName, page) -> {
                TypeDefinition type = types.get(typeName);
                List<IncomingLink> links = page.stream().map(Instances::incomingLink).filter(Objects::nonNull).toList();
                groups.add(new IncomingLinksOfType(typeName, typeLabel(typeName, type), type != null ? type.color() : null, links,
                        page.total(), page.nextMarker()));
            });
            result.add(new IncomingLinks(property, incomingLinksLabel(property, groups, fields), groups));
        });
        return result;
    }

    /**
     * The name for the reverse link defined for the property by any of the linking types - or the name of the property
     * if there is none.
     */
    private static String incomingLinksLabel(String property, List<IncomingLinksOfType> groups, Map<String, List<FieldDefinition>> fields) {
        List<FieldDefinition> definitions = groups.stream().flatMap(g -> fields.getOrDefault(g.typeIdentifier(), List.of()).stream())
                .filter(d -> property.equals(d.identifier())).toList();
        return definitions.stream().map(FieldDefinition::reverseLinkLabel).filter(l -> l != null && !l.isBlank()).findFirst()
                .orElseGet(() -> definitions.stream().map(FieldDefinition::label).findFirst().orElseGet(() -> typeLabel(property, null)));
    }

    /**
     * Translates an instance linking to another one into an incoming link - its label and space are only known if it is
     * readable by the user. Since it links to the instance, it has outgoing links in any case.
     */
    private static IncomingLink incomingLink(LinkingInstance link) {
        if (link.id() == null) {
            return null;
        }
        String id = link.id().toString();
        if (link.isRestricted()) {
            return new IncomingLink(id, id, "", null, null, LinkStatus.RESTRICTED);
        }
        return new IncomingLink(id, link.label() != null && !link.label().isBlank() ? link.label() : id,
                Objects.requireNonNullElse(link.space(), ""), true, link.hasIncomingLinks(), LinkStatus.RESOLVED);
    }

    /**
     * The instances linked by the given fields - labeled with the field they are linked by.
     */
    static List<LinkedInstance> directLinks(List<Field> fields) {
        return fields.stream().filter(f -> f.kind().isLink())
                .flatMap(f -> values(f.value()).stream().map(l -> ((LinkedInstance) l).withFieldLabel(f.label()))).toList();
    }

    /**
     * The fields of the instance as defined by its type (in the order to be shown) - the linked instances are described
     * by the summary of the outgoing links provided by the core (only their types are looked up).
     */
    private List<Field> fields(MarmotGraphClient client, org.marmotgraph.sdk.model.Instance instance, String typeName) {
        List<FieldDefinition> definitions = typeName != null ? fieldCache.get(client, typeName) : List.of();
        List<String> linkedTypeNames = definitions.stream().filter(d -> d.kind().isLink())
                .flatMap(d -> values(instance.get(d.identifier())).stream())
                .map(l -> l instanceof Map<?, ?> link ? firstString(link.get("@type")) : null).filter(Objects::nonNull).distinct().toList();
        Map<String, TypeDefinition> linkedTypes = linkedTypeNames.isEmpty() ? Map.of() : typeCache.get(client, linkedTypeNames);
        return definitions.stream().map(d -> field(d, instance.get(d.identifier()), linkedTypes)).toList();
    }

    /**
     * The field of the given definition with the JSON-LD value of its property (null for an empty field) translated
     * into the shape required by its kind.
     */
    static Field field(FieldDefinition definition, Object value, Map<String, TypeDefinition> linkedTypes) {
        return new Field(definition.identifier(), definition.label(), definition.kind(), fieldValue(definition.kind(), value, linkedTypes),
                definition.required(), definition.readOnly(), definition.tooltip(), definition.targetTypes().isEmpty() ? null : definition.targetTypes());
    }

    /**
     * Translates the JSON-LD value of a property into the shape required by the kind of the field: a string for the
     * textual ones, a number, a boolean, a linked instance (or a list of them) - and the value as is for the
     * unsupported ones.
     */
    static Object fieldValue(FieldKind kind, Object value, Map<String, TypeDefinition> linkedTypes) {
        return switch (kind) {
            case TEXT, TEXTAREA, DATE, DATETIME, TIME, COLOR -> firstString(value);
            case NUMBER -> toNumber(firstString(value));
            case CHECKBOX -> {
                String s = firstString(value);
                yield s != null ? Boolean.parseBoolean(s) : null;
            }
            case LINK -> values(value).stream().map(l -> linkedInstance(l, linkedTypes)).filter(Objects::nonNull).findFirst().orElse(null);
            case LINKS -> values(value).stream().map(l -> linkedInstance(l, linkedTypes)).filter(Objects::nonNull).toList();
            case UNSUPPORTED -> value;
        };
    }

    private static Number toNumber(String value) {
        if (value == null) {
            return null;
        }
        try {
            return value.contains(".") || value.contains("e") || value.contains("E") ? Double.parseDouble(value) : Long.parseLong(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static List<?> values(Object value) {
        return value instanceof List<?> list ? list : value != null ? List.of(value) : List.of();
    }

    /**
     * Translates a link (as summarized by the core) into a linked instance - null if the value is no link. Links without
     * a summary are treated as unresolved.
     */
    private static LinkedInstance linkedInstance(Object reference, Map<String, TypeDefinition> linkedTypes) {
        if (!(reference instanceof Map<?, ?> link)) {
            return null;
        }
        String identifier = firstString(link.get("@id"));
        if (identifier == null || identifier.isBlank()) {
            return null;
        }
        String resolvedId = firstString(link.get(LINK_RESOLVED_ID));
        String id = resolvedId != null ? new org.marmotgraph.sdk.model.Instance(Map.of("@id", resolvedId)).getUuid().map(UUID::toString).orElse(null) : null;
        LinkStatus status = id != null ? LinkStatus.of(firstString(link.get(LINK_STATUS))) : LinkStatus.UNRESOLVED;
        if (status == LinkStatus.UNRESOLVED) {
            return new LinkedInstance(identifier, identifier, "", null, "", null, null, null, status);
        }
        String typeName = firstString(link.get("@type"));
        TypeDefinition type = typeName != null ? linkedTypes.get(typeName) : null;
        String label = status == LinkStatus.RESOLVED ? firstString(link.get(LINK_LABEL)) : null;
        String space = status == LinkStatus.RESOLVED ? firstString(link.get(LINK_SPACE)) : null;
        // the target is linked by the instance itself, so it has incoming links in any case
        Boolean hasOutgoingLinks = status == LinkStatus.RESOLVED && link.get(LINK_HAS_OUTGOING_LINKS) instanceof Boolean b ? b : null;
        return new LinkedInstance(id, label != null && !label.isBlank() ? label : id, typeLabel(typeName, type), type != null ? type.color() : null,
                Objects.requireNonNullElse(space, ""), null, hasOutgoingLinks, status == LinkStatus.RESOLVED ? true : null, status);
    }

    private static List<String> nonBlank(List<String> values) {
        return values == null ? List.of() : values.stream().filter(v -> v != null && !v.isBlank()).map(String::trim).distinct().toList();
    }

    /**
     * The name of the type as defined in the core - or the last segment of its IRI if there is none.
     */
    static String typeLabel(String typeName, TypeDefinition type) {
        if (type != null && type.name() != null) {
            return type.name();
        }
        if (typeName == null) {
            return "";
        }
        return typeName.substring(Math.max(typeName.lastIndexOf('/'), typeName.lastIndexOf('#')) + 1);
    }

    /**
     * The value of the label property defined for the type - or the id of the instance if there is none.
     */
    static String instanceName(Map<String, Object> instance, TypeDefinition type, String instanceId) {
        String label = type != null && type.labelProperty() != null ? firstString(instance.get(type.labelProperty())) : null;
        return label != null && !label.isBlank() ? label : instanceId;
    }

    static String permissions(Object functionalities) {
        Collection<?> values = functionalities instanceof Collection<?> c ? c : functionalities != null ? List.of(functionalities) : List.of();
        List<String> granted = values.stream().map(Object::toString).toList();
        return PERMISSION_LABELS.entrySet().stream().filter(e -> granted.contains(e.getKey())).map(Map.Entry::getValue).collect(Collectors.joining(", "));
    }

    /**
     * JSON-LD values can be single values, lists or value objects - this returns the first plain value as a string.
     */
    private static String firstString(Object value) {
        if (value instanceof List<?> list) {
            return list.isEmpty() ? null : firstString(list.getFirst());
        }
        if (value instanceof Map<?, ?> map) {
            return firstString(map.containsKey("@value") ? map.get("@value") : map.get("@id"));
        }
        return value != null ? value.toString() : null;
    }

}
