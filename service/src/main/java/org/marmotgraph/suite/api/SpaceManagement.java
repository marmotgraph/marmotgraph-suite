package org.marmotgraph.suite.api;

import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.SpaceInformation;
import org.marmotgraph.sdk.model.SpaceSpecification;
import org.marmotgraph.sdk.model.SpaceTypeInformation;
import org.marmotgraph.sdk.model.Stage;
import org.marmotgraph.sdk.model.TypeInformation;
import org.marmotgraph.sdk.resources.SpaceListOptions;
import org.marmotgraph.sdk.resources.TypeListOptions;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.marmotgraph.suite.spaces.SpaceCache;
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
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Manages the spaces of the MarmotGraph core - their specification and the types assigned to them - on behalf of the
 * user who issued the request (who needs the MANAGE_SPACE functionality for the space in the core). Specifying a space
 * which doesn't exist yet creates it. The claims of the roles in a space are managed by {@link Permissions}.
 */
@AllArgsConstructor
@RestController
@RequestMapping("/admin/spaces")
public class SpaceManagement {

    /**
     * The settings of a space which can be specified.
     */
    public record Settings(boolean autoRelease, boolean clientSpace, boolean deferCache) {
    }

    /**
     * A space the user is allowed to manage.
     */
    public record ManagedSpace(String identifier, String name) {
    }

    /**
     * The specification of a space.
     *
     * @param specified whether the space has a specification - otherwise, it has the default settings
     */
    public record SpaceDetails(String identifier, Settings settings, boolean specified) {
    }

    /**
     * A type with its relation to a space.
     *
     * @param assigned    whether the type is explicitly assigned to the space (e.g. to be offered when creating
     *                    instances there)
     * @param occurrences the number of instances of the type in the space
     */
    public record SpaceType(String identifier, String name, String color, boolean assigned, int occurrences) {
    }

    private static final String MANAGE_SPACE = "MANAGE_SPACE";

    /**
     * Space names are used as path segment in the requests to the core - they are therefore restricted to a safe set
     * of characters.
     */
    private static final Pattern SPACE_NAME = Pattern.compile("[\\w.-]+");

    /**
     * The spaces of the core which can't be specified: the private space of the user and the one of the invitations.
     */
    private static final Set<String> RESERVED_SPACES = Set.of(Queries.PRIVATE_SPACE, "review");

    private final SpaceCache spaceCache;

    /**
     * The spaces the user is allowed to manage sorted by their identifier.
     */
    @GetMapping
    public List<ManagedSpace> list(@AuthenticatedClient MarmotGraphClient client) {
        return client.spaces().list(SpaceListOptions.builder().permissions(true).build()).allItems()
                .filter(space -> space.identifier() != null && !RESERVED_SPACES.contains(space.identifier()) && canManage(space))
                .sorted(Comparator.comparing(SpaceInformation::identifier))
                .map(space -> new ManagedSpace(space.identifier(), space.name()))
                .toList();
    }

    @GetMapping("/{space}")
    public SpaceDetails get(@AuthenticatedClient MarmotGraphClient client, @PathVariable String space) {
        SpaceSpecification specification = client.spaces().getSpecification(requireSpecifiable(space));
        Settings settings = new Settings(Boolean.TRUE.equals(specification.autorelease()), Boolean.TRUE.equals(specification.clientSpace()),
                Boolean.TRUE.equals(specification.deferCache()));
        return new SpaceDetails(space, settings, Boolean.TRUE.equals(specification.explicitSpecification()));
    }

    /**
     * Creates or replaces the specification of the space (creating the space if it doesn't exist yet).
     */
    @PutMapping("/{space}")
    public void createOrUpdate(@AuthenticatedClient MarmotGraphClient client, @PathVariable String space, @RequestBody Settings settings) {
        client.spaces().createOrUpdateSpecification(requireSpecifiable(space),
                new SpaceSpecification(null, null, settings.autoRelease(), settings.clientSpace(), settings.deferCache()));
        spaceCache.invalidate(space);
    }

    /**
     * Removes the specification of the space - the core removes the space if there are no types in it. Otherwise, it
     * is kept with the default settings.
     */
    @DeleteMapping("/{space}")
    public void delete(@AuthenticatedClient MarmotGraphClient client, @PathVariable String space) {
        client.spaces().deleteSpecification(requireSpecifiable(space));
        spaceCache.invalidate(space);
    }

    /**
     * The types (of those the user has access to) sorted by their name - along with whether they are assigned to the
     * space and how often they occur in it. The core only allows to check the assignment for one type at a time - they
     * are checked concurrently.
     */
    @GetMapping("/{space}/types")
    public List<SpaceType> types(@AuthenticatedClient MarmotGraphClient client, @PathVariable String space) {
        requireSpecifiable(space);
        return client.types().list(TypeListOptions.builder().stage(Stage.IN_PROGRESS).withOccurrenceCount(true).build()).allItems()
                .filter(type -> type.identifier() != null)
                .toList().parallelStream()
                .map(type -> new SpaceType(type.identifier(), type.name(), type.color(), isAssigned(client, space, type.identifier()),
                        occurrences(type, space)))
                .sorted(Comparator.comparing((SpaceType type) -> Objects.requireNonNullElse(type.name(), type.identifier()), String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @PutMapping("/{space}/types")
    public void assignType(@AuthenticatedClient MarmotGraphClient client, @PathVariable String space, @RequestParam String type) {
        client.spaces().assignType(requireSpecifiable(space), requireType(type));
    }

    @DeleteMapping("/{space}/types")
    public void removeType(@AuthenticatedClient MarmotGraphClient client, @PathVariable String space, @RequestParam String type) {
        requireSpecifiable(space);
        requireType(type);
        try {
            client.spaces().removeType(space, type);
        } catch (MarmotGraphApiException e) {
            // A type which is not found in the space isn't part of it anyway
            if (e.statusCode() != HttpStatus.NOT_FOUND.value()) {
                throw e;
            }
        }
    }

    private static boolean canManage(SpaceInformation space) {
        return space.permissions() != null && space.permissions().contains(MANAGE_SPACE);
    }

    /**
     * If the type is assigned to the space - the core reports a type which is not part of the space as not found.
     */
    private static boolean isAssigned(MarmotGraphClient client, String space, String type) {
        try {
            return client.spaces().getType(space, type).isPresent();
        } catch (MarmotGraphApiException e) {
            if (e.statusCode() == HttpStatus.NOT_FOUND.value()) {
                return false;
            }
            throw e;
        }
    }

    private static int occurrences(TypeInformation type, String space) {
        return type.spaces() == null ? 0 : type.spaces().stream().filter(s -> space.equals(s.space()))
                .map(SpaceTypeInformation::occurrences).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
    }

    private static String requireSpecifiable(String space) {
        if (space == null || !SPACE_NAME.matcher(space).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Space names may only contain letters, digits, \".\", \"-\" and \"_\"");
        }
        if (RESERVED_SPACES.contains(space)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.format("The space \"%s\" can't be specified", space));
        }
        return space;
    }

    private static String requireType(String type) {
        if (type == null || type.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The type is missing");
        }
        return type;
    }

}
