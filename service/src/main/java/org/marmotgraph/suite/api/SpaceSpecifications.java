package org.marmotgraph.suite.api;

import lombok.AllArgsConstructor;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.SpaceInformation;
import org.marmotgraph.sdk.model.SpaceSpecification;
import org.marmotgraph.sdk.resources.SpaceListOptions;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.marmotgraph.suite.spaces.SpaceCache;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * Manages the specifications of the spaces of the MarmotGraph core - on behalf of the user who issued the request (who
 * needs the MANAGE_SPACE functionality for the space in the core). Specifying a space which doesn't exist yet creates it.
 */
@AllArgsConstructor
@RestController
@RequestMapping("/admin/spaces")
public class SpaceSpecifications {

    /**
     * The settings of a space which can be specified.
     */
    public record Settings(boolean autoRelease, boolean clientSpace, boolean deferCache) {
    }

    /**
     * A space and its settings - which are null if the user is not allowed to manage the space.
     *
     * @param specified whether the space has a specification - otherwise, it has the default settings (only known if
     *                  the user is allowed to manage the space)
     */
    public record ManagedSpace(String identifier, Settings settings, boolean specified) {
    }

    private static final String MANAGE_SPACE = "MANAGE_SPACE";

    /**
     * The spaces of the core which can't be specified: the private space of the user and the one of the invitations.
     */
    private static final Set<String> RESERVED_SPACES = Set.of(Queries.PRIVATE_SPACE, "review");

    private final SpaceCache spaceCache;

    /**
     * The spaces visible to the user sorted by their identifier. The core provides no bulk lookup of the
     * specifications, so they are fetched one by one.
     */
    @GetMapping
    public List<ManagedSpace> list(@AuthenticatedClient MarmotGraphClient client) {
        return client.spaces().list(SpaceListOptions.builder().permissions(true).build()).allItems()
                .filter(space -> space.identifier() != null && !RESERVED_SPACES.contains(space.identifier()))
                .sorted(Comparator.comparing(SpaceInformation::identifier))
                .toList().parallelStream()
                .map(space -> canManage(space) ? managedSpace(client, space.identifier()) : new ManagedSpace(space.identifier(), null, false))
                .toList();
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

    private static boolean canManage(SpaceInformation space) {
        return space.permissions() != null && space.permissions().contains(MANAGE_SPACE);
    }

    private static ManagedSpace managedSpace(MarmotGraphClient client, String space) {
        SpaceSpecification specification = client.spaces().getSpecification(space);
        Settings settings = new Settings(Boolean.TRUE.equals(specification.autorelease()), Boolean.TRUE.equals(specification.clientSpace()),
                Boolean.TRUE.equals(specification.deferCache()));
        return new ManagedSpace(space, settings, Boolean.TRUE.equals(specification.explicitSpecification()));
    }

    private static String requireSpecifiable(String space) {
        if (RESERVED_SPACES.contains(Modeler.requireSpace(space))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.format("The space \"%s\" can't be specified", space));
        }
        return space;
    }

}
