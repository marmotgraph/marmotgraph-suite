package org.marmotgraph.suite.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.LinkingInstance;
import org.marmotgraph.sdk.model.ReleaseStatus;
import org.marmotgraph.sdk.model.ReleaseTreeScope;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Provides the instances shown in the editor by listing / fetching them from the MarmotGraph core - on behalf of the user who
 * issued the request. The type information (name, description, color, label property) is taken from the {@link TypeCache}.
 * <p>
 * TODO bookmarks and the last visit are not (yet) provided by the core - they are always reported as not bookmarked /
 * never visited. Only the first page of instances is returned.
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
     * The condensed representation of an instance as listed in the overview of the editor.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record InstanceSummary(int id, String instanceId, String type, String typeDescription, String typeColor, String instanceName, String space,
                           String permissions, boolean bookmarked, String lastVisited, String releaseStatus) {
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
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record InstanceDetail(String instanceId, String type, String typeDescription, String typeColor, String instanceName,
                                 String space, String permissions, String releaseStatus, List<Field> fields,
                                 List<LinkedInstance> directLinks) {
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
     * The properties added to each link by the core if a summary of the outgoing links is requested.
     */
    static final String LINK_STATUS = "_linkStatus";
    static final String LINK_RESOLVED_ID = "_resolvedId";
    static final String LINK_LABEL = "_label";
    static final String LINK_SPACE = "_space";
    static final String LINK_HAS_OUTGOING_LINKS = "_hasOutgoingLinks";

    private static final String RELEASED = "released";
    private static final String IN_PROGRESS = "in progress";

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
     */
    @GetMapping
    public List<InstanceSummary> list(@AuthenticatedClient MarmotGraphClient client, @RequestParam(required = false) String search,
                               @RequestParam(name = "type", required = false) List<String> typeFilter,
                               @RequestParam(name = "space", required = false) List<String> spaceFilter) {
        List<org.marmotgraph.sdk.model.Instance> instances = client.instances().list(InstanceListOptions.builder()
                .stage(Stage.IN_PROGRESS)
                .types(nonBlank(typeFilter))
                .spaces(nonBlank(spaceFilter))
                .searchByLabel(search != null && !search.isBlank() ? search.trim() : null)
                .responseOptions(ResponseOptions.builder().returnPermissions(true).build())
                .build()).items();
        if (instances.isEmpty()) {
            return List.of();
        }
        List<String> typeNames = instances.stream().map(org.marmotgraph.sdk.model.Instance::getType).filter(Objects::nonNull).distinct().toList();
        Map<String, TypeDefinition> types = typeNames.isEmpty() ? Map.of() : typeCache.get(client, typeNames);
        List<UUID> ids = instances.stream().map(i -> i.getUuid().orElse(null)).filter(Objects::nonNull).toList();
        Map<String, ReleaseStatus> releaseStatuses = ids.isEmpty() ? Map.of() : client.instances().releaseStatusByIds(ids, ReleaseTreeScope.TOP_INSTANCE_ONLY);

        List<InstanceSummary> result = new ArrayList<>(instances.size());
        for (org.marmotgraph.sdk.model.Instance instance : instances) {
            String instanceId = instance.getUuid().map(UUID::toString).orElse(instance.getId());
            String typeName = instance.getType();
            TypeDefinition type = typeName != null ? types.get(typeName) : null;
            result.add(new InstanceSummary(result.size() + 1, instanceId, typeLabel(typeName, type), type != null ? type.description() : null, type != null ? type.color() : null,
                    instanceName(instance, type, instanceId), instance.getSpace(),
                    permissions(instance.getPermissions()), false, null,
                    releaseStatuses.get(instanceId) == ReleaseStatus.RELEASED ? RELEASED : IN_PROGRESS));
        }
        return result;
    }

    /**
     * @param id the uuid of the instance as known by the core
     */
    @GetMapping("/{id}")
    public InstanceDetail get(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        org.marmotgraph.sdk.model.Instance instance = client.instances().get(id, Stage.IN_PROGRESS,
                ResponseOptions.builder().returnPermissions(true).returnSummaryOfOutgoingLinks(true).build());
        String instanceId = instance.getUuid().map(UUID::toString).orElse(id.toString());
        String typeName = instance.getType();
        TypeDefinition type = typeName != null ? typeCache.get(client, List.of(typeName)).get(typeName) : null;
        ReleaseStatus releaseStatus = client.instances().releaseStatus(id, ReleaseTreeScope.TOP_INSTANCE_ONLY);
        List<Field> fields = fields(client, instance, typeName);
        return new InstanceDetail(instanceId, typeLabel(typeName, type), type != null ? type.description() : null, type != null ? type.color() : null,
                instanceName(instance, type, instanceId), instance.getSpace(), permissions(instance.getPermissions()),
                releaseStatus == ReleaseStatus.RELEASED ? RELEASED : IN_PROGRESS, fields, directLinks(fields));
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
        return definitions.stream().map(d -> new Field(d.identifier(), d.label(), d.kind(), fieldValue(d.kind(), instance.get(d.identifier()), linkedTypes),
                d.required(), d.readOnly(), d.tooltip(), d.targetTypes().isEmpty() ? null : d.targetTypes())).toList();
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
