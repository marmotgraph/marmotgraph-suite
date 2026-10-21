package org.marmotgraph.suite.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.ReleaseStatus;
import org.marmotgraph.sdk.model.ReleaseTreeScope;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.resources.InstanceListOptions;
import org.marmotgraph.sdk.resources.ResponseOptions;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.marmotgraph.suite.types.TypeCache;
import org.marmotgraph.suite.types.TypeCache.TypeDefinition;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
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

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LinkedInstance(String instanceId, String instanceName, String type, String space, String fieldLabel,
                                 Boolean hasDirectLinks, Boolean hasReverseLinks) {
    }

    /**
     * The condensed representation of an instance as listed in the overview of the editor.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record InstanceSummary(int id, String instanceId, String type, String typeDescription, String typeColor, String instanceName, String space,
                           String permissions, boolean bookmarked, String lastVisited, String releaseStatus) {
    }

    /**
     * The representation of a single instance as shown in its detail view - this is going to be extended with the
     * properties and links of the instance.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record InstanceDetail(String instanceId, String type, String typeDescription, String typeColor, String instanceName,
                                 String space, String permissions, String releaseStatus) {
    }

    static final String SPACE = "https://core.kg.ebrains.eu/vocab/meta/space";
    static final String PERMISSIONS = "https://core.kg.ebrains.eu/vocab/meta/permissions";

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
        List<String> typeNames = instances.stream().map(Instances::primaryType).filter(Objects::nonNull).distinct().toList();
        Map<String, TypeDefinition> types = typeNames.isEmpty() ? Map.of() : typeCache.get(client, typeNames);
        List<UUID> ids = instances.stream().map(i -> i.getUuid().orElse(null)).filter(Objects::nonNull).toList();
        Map<String, ReleaseStatus> releaseStatuses = ids.isEmpty() ? Map.of() : client.instances().releaseStatusByIds(ids, ReleaseTreeScope.TOP_INSTANCE_ONLY);

        List<InstanceSummary> result = new ArrayList<>(instances.size());
        for (org.marmotgraph.sdk.model.Instance instance : instances) {
            String instanceId = instance.getUuid().map(UUID::toString).orElse(instance.getId());
            String typeName = primaryType(instance);
            TypeDefinition type = typeName != null ? types.get(typeName) : null;
            result.add(new InstanceSummary(result.size() + 1, instanceId, typeLabel(typeName, type), type != null ? type.description() : null, type != null ? type.color() : null,
                    instanceName(instance, type, instanceId), firstString(instance.get(SPACE)),
                    permissions(instance.get(PERMISSIONS)), false, null,
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
                ResponseOptions.builder().returnPermissions(true).build());
        String instanceId = instance.getUuid().map(UUID::toString).orElse(id.toString());
        String typeName = primaryType(instance);
        TypeDefinition type = typeName != null ? typeCache.get(client, List.of(typeName)).get(typeName) : null;
        ReleaseStatus releaseStatus = client.instances().releaseStatus(id, ReleaseTreeScope.TOP_INSTANCE_ONLY);
        return new InstanceDetail(instanceId, typeLabel(typeName, type), type != null ? type.description() : null, type != null ? type.color() : null,
                instanceName(instance, type, instanceId), firstString(instance.get(SPACE)), permissions(instance.get(PERMISSIONS)),
                releaseStatus == ReleaseStatus.RELEASED ? RELEASED : IN_PROGRESS);
    }

    private static List<String> nonBlank(List<String> values) {
        return values == null ? List.of() : values.stream().filter(v -> v != null && !v.isBlank()).map(String::trim).distinct().toList();
    }

    private static String primaryType(org.marmotgraph.sdk.model.Instance instance) {
        List<String> types = instance.getTypes();
        return types.isEmpty() ? null : types.getFirst();
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
