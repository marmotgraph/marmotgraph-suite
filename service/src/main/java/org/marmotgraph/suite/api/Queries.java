package org.marmotgraph.suite.api;

import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.IncomingLink;
import org.marmotgraph.sdk.model.JsonLdDocument;
import org.marmotgraph.sdk.model.Property;
import org.marmotgraph.sdk.model.QuerySpecification;
import org.marmotgraph.sdk.model.SourceType;
import org.marmotgraph.sdk.model.SpaceInformation;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.StoredQuery;
import org.marmotgraph.sdk.model.TargetType;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.sdk.pagination.Page;
import org.marmotgraph.sdk.resources.QueryRunOptions;
import org.marmotgraph.sdk.resources.SpaceListOptions;
import org.marmotgraph.sdk.resources.TypeListOptions;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Backs the query builder: lists, loads, stores and removes the stored queries, runs queries (also unsaved
 * ones) and provides the structure of the types (their properties and incoming links) to compose queries from.
 */
@AllArgsConstructor
@RestController
@RequestMapping("/queries")
public class Queries {

    /** The name the core resolves to the private space of the user */
    static final String PRIVATE_SPACE = "myspace";

    private static final Pattern SPACE_NAME = Pattern.compile("[\\w.-]+");

    /** The request parameters of the run endpoint - all others are values for the parametrized filters of the query. */
    private static final Set<String> RUN_PARAMETERS = Set.of("stage", "size", "marker", "instanceId", "restrictToSpaces");

    /** A stored query as listed (without its structure) */
    public record QuerySummary(String id, String label, String description, String type, String space) {
    }

    /** A stored query with its specification - the space is "myspace" for the private space of the user. */
    public record QueryDocument(String id, String space, QuerySpecification specification) {

        static QueryDocument of(StoredQuery query) {
            return new QueryDocument(query.id() != null ? query.id().toString() : null, query.space(), query.specification());
        }
    }

    /** A space queries can be stored in - with what the user is allowed to do with the queries in it. */
    public record QuerySpace(String identifier, String name, boolean isPrivate, boolean canCreate, boolean canWrite,
                             boolean canDelete) {
    }

    /**
     * A property a query can follow from a type - an incoming link is followed in reverse (its label is the name of the
     * reverse link if the source type defines one).
     */
    public record QueryProperty(String identifier, String label, boolean reverse, List<String> targetTypes) {
    }

    /** A type a query can start from or reach - with the properties to follow from it. */
    public record QueryType(String identifier, String name, String description, String color, List<QueryProperty> properties) {
    }

    /** A page of the results of a query */
    public record QueryResult(List<JsonLdDocument> data, Integer total, Integer size, String nextMarker, Double durationInMs) {

        static QueryResult of(Page<JsonLdDocument> page) {
            return new QueryResult(page.items(), page.total(), page.size(), page.nextMarker(), page.execution().durationInMs());
        }
    }

    /** Lists the stored queries the user can read - optionally only the ones of a root type and / or matching a text. */
    @GetMapping
    public List<QuerySummary> list(@AuthenticatedClient MarmotGraphClient client, @RequestParam(required = false) String type,
                                   @RequestParam(required = false) String search) {
        return client.queries().list(blankToNull(type), blankToNull(search), null, 200, false).allItems().map(query -> {
            QuerySpecification.Meta meta = query.meta() != null ? query.meta() : new QuerySpecification.Meta(null, null, null);
            return new QuerySummary(query.id() != null ? query.id().toString() : null, meta.name(), meta.description(),
                    meta.type(), query.space());
        }).toList();
    }

    /**
     * The spaces with the permissions of the user in them - the private space of the user is flagged (and listed first).
     */
    @GetMapping("/spaces")
    public List<QuerySpace> spaces(@AuthenticatedClient MarmotGraphClient client) {
        SpaceInformation privateSpace = privateSpace(client);
        Map<String, QuerySpace> result = new LinkedHashMap<>();
        if (privateSpace != null) {
            result.put(privateSpace.identifier(), space(privateSpace, true));
        }
        client.spaces().list(SpaceListOptions.builder().permissions(true).build()).allItems()
                .filter(space -> space.identifier() != null)
                .sorted(Comparator.comparing(SpaceInformation::identifier))
                .forEach(space -> result.putIfAbsent(space.identifier(), space(space, false)));
        return List.copyOf(result.values());
    }

    private static SpaceInformation privateSpace(MarmotGraphClient client) {
        try {
            return client.spaces().get(PRIVATE_SPACE, true);
        } catch (MarmotGraphApiException e) {
            // Users without a private space (e.g. service accounts) can still store queries in shared spaces
            if (e.statusCode() == HttpStatus.NOT_FOUND.value()) {
                return null;
            }
            throw e;
        }
    }

    private static QuerySpace space(SpaceInformation space, boolean isPrivate) {
        List<String> permissions = space.permissions() != null ? space.permissions() : List.of();
        return new QuerySpace(space.identifier(), space.name(), isPrivate, permissions.contains("CREATE"),
                permissions.contains("WRITE"), permissions.contains("DELETE"));
    }

    /**
     * The types with their properties and incoming links - both as found in the data, merged with their specifications.
     */
    @GetMapping("/types")
    public List<QueryType> types(@AuthenticatedClient MarmotGraphClient client) {
        List<TypeInformation> types = client.types().list(TypeListOptions.builder().stage(Stage.IN_PROGRESS)
                .withProperties(true).withIncomingLinks(true).withOccurrenceCount(false).build()).allItems().toList();
        // The name of an incoming link is given by the property of its source type
        Map<String, Map<String, String>> reverseNames = new HashMap<>();
        types.forEach(type -> properties(type).stream().filter(p -> p.nameForReverseLink() != null && p.identifier() != null)
                .forEach(p -> reverseNames.computeIfAbsent(type.identifier(), t -> new HashMap<>()).put(p.identifier(), p.nameForReverseLink())));
        return types.stream().filter(type -> type.identifier() != null).map(type -> queryType(type, reverseNames))
                .sorted(Comparator.comparing(type -> type.name() != null ? type.name() : type.identifier(), String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private static List<Property> properties(TypeInformation type) {
        return type.properties() != null ? type.properties() : List.of();
    }

    private static QueryType queryType(TypeInformation type, Map<String, Map<String, String>> reverseNames) {
        List<QueryProperty> properties = new ArrayList<>();
        properties(type).stream().filter(p -> p.identifier() != null).forEach(p -> properties.add(new QueryProperty(p.identifier(),
                p.name(), false, p.targetTypes() == null ? List.of() :
                p.targetTypes().stream().map(TargetType::type).filter(Objects::nonNull).distinct().toList())));
        List<IncomingLink> incomingLinks = type.incomingLinks() != null ? type.incomingLinks() : List.of();
        incomingLinks.stream().filter(link -> link.identifier() != null).forEach(link -> {
            List<String> sourceTypes = link.sourceTypes() == null ? List.of() :
                    link.sourceTypes().stream().map(SourceType::type).filter(Objects::nonNull).distinct().toList();
            String label = sourceTypes.stream().map(source -> reverseNames.getOrDefault(source, Map.of()).get(link.identifier()))
                    .filter(Objects::nonNull).findFirst().orElse(null);
            properties.add(new QueryProperty(link.identifier(), label, true, sourceTypes));
        });
        return new QueryType(type.identifier(), type.name(), type.description(), type.color(), properties);
    }

    /** The stored query with the given id */
    @GetMapping("/{queryId}")
    public QueryDocument get(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID queryId) {
        return QueryDocument.of(client.queries().getSpecification(queryId));
    }

    /**
     * Stores the query - the space is only required if the query is created (a stored query can't change its space).
     */
    @PutMapping("/{queryId}")
    public QueryDocument save(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID queryId,
                              @RequestParam(required = false) String space, @RequestBody QuerySpecification specification) {
        requireRootType(specification);
        return QueryDocument.of(client.queries().save(queryId, specification, space != null ? requireSpace(space) : null));
    }

    @DeleteMapping("/{queryId}")
    public void delete(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID queryId) {
        client.queries().remove(queryId);
    }

    /**
     * Runs the query without storing it. All request parameters except the ones of the run itself
     * are the values of the parametrized filters of the query.
     */
    @PostMapping("/run")
    public QueryResult run(@AuthenticatedClient MarmotGraphClient client, @RequestBody QuerySpecification specification,
                           @RequestParam(defaultValue = "RELEASED") Stage stage, @RequestParam(defaultValue = "20") int size,
                           @RequestParam(required = false) String marker, @RequestParam(required = false) UUID instanceId,
                           @RequestParam(required = false) List<String> restrictToSpaces,
                           @RequestParam Map<String, String> parameters) {
        requireRootType(specification);
        if (size < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The size needs to be at least 1");
        }
        Map<String, Object> filterValues = new LinkedHashMap<>(parameters);
        RUN_PARAMETERS.forEach(filterValues::remove);
        QueryRunOptions options = QueryRunOptions.builder().stage(stage).size(size).marker(blankToNull(marker))
                .instanceId(instanceId).restrictToSpaces(restrictToSpaces).returnTotalResults(true).build();
        return QueryResult.of(client.queries().run(specification, options, filterValues));
    }

    private static void requireRootType(QuerySpecification specification) {
        if (specification.meta() == null || specification.meta().type() == null || specification.meta().type().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A query needs to specify the type it starts from (\"meta.type\")");
        }
    }

    private static String requireSpace(String space) {
        if (!SPACE_NAME.matcher(space).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Space names may only contain letters, digits, \".\", \"-\" and \"_\"");
        }
        return space;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

}
