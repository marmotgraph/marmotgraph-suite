package org.marmotgraph.suite.api;

import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.JsonLdDocument;
import org.marmotgraph.sdk.model.RoleMapping;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Manages the claims mapped to the roles of the MarmotGraph core (globally or per space) - on behalf of the user who
 * issued the request (who needs the rights to manage permissions in the core).
 */
@RestController
@RequestMapping("/admin/permissions")
public class Permissions {

    /**
     * The claims a role is granted for - globally if the space is null. The claims are a pattern matched against the
     * claims of the token of a user (e.g. {"roles": {"group": ["admins"]}}).
     */
    public record RoleDefinition(String space, String role, Map<String, Object> claims) {
    }

    /**
     * The property of a role definition the core identifies it with ("space:role" - the space is empty for global roles).
     */
    static final String KEY = "_key";

    /**
     * The role definitions known to the core - sorted by space (global first) and role (in the order of the roles of
     * the core).
     */
    @GetMapping
    public List<RoleDefinition> list(@AuthenticatedClient MarmotGraphClient client) {
        return client.setup().listRoleDefinitions().stream().map(Permissions::roleDefinition).filter(Objects::nonNull)
                .sorted(Comparator.comparing((RoleDefinition d) -> d.space() != null ? d.space() : "")
                        .thenComparing(d -> roleOrder(d.role())))
                .toList();
    }

    /**
     * The roles claims can be mapped to - in the order of the roles of the core (each one inheriting the
     * functionalities of the previous ones - except for admin).
     */
    @GetMapping("/roles")
    public List<String> roles() {
        return Arrays.stream(RoleMapping.values()).map(Permissions::roleName).toList();
    }

    /**
     * Adds the claim pattern to the role (or removes it if remove is set) - the remaining definition of the role is
     * returned (with empty claims if nothing remains).
     *
     * @param space the space the role is defined for - global if absent
     */
    @PatchMapping("/{role}")
    public RoleDefinition update(@AuthenticatedClient MarmotGraphClient client, @PathVariable String role,
                                 @RequestParam(required = false) String space, @RequestParam(defaultValue = "false") boolean remove,
                                 @RequestBody Map<String, Object> claim) {
        RoleMapping roleMapping = roleMapping(role);
        String spaceName = space != null && !space.isBlank() ? space.trim() : null;
        JsonLdDocument result = remove ? client.setup().deleteRoleDefinition(roleMapping, claim, spaceName)
                : client.setup().createRoleDefinition(roleMapping, claim, spaceName);
        return new RoleDefinition(spaceName, roleName(roleMapping), claims(result));
    }

    static RoleDefinition roleDefinition(JsonLdDocument document) {
        Object key = document.get(KEY);
        if (key == null) {
            return null;
        }
        String[] split = key.toString().split(":", 2);
        if (split.length != 2) {
            return null;
        }
        return new RoleDefinition(split[0].isBlank() ? null : split[0], split[1], claims(document));
    }

    private static Map<String, Object> claims(Map<String, Object> document) {
        Map<String, Object> claims = new LinkedHashMap<>(document != null ? document : Map.of());
        claims.remove(KEY);
        return claims;
    }

    private static RoleMapping roleMapping(String role) {
        return Arrays.stream(RoleMapping.values()).filter(r -> roleName(r).equalsIgnoreCase(role)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, String.format("Unknown role \"%s\"", role)));
    }

    /**
     * The name the core identifies the role with in its definitions.
     */
    static String roleName(RoleMapping role) {
        return role.name().toLowerCase();
    }

    private static int roleOrder(String role) {
        return Arrays.stream(RoleMapping.values()).filter(r -> roleName(r).equals(role)).findFirst()
                .map(Enum::ordinal).orElse(Integer.MAX_VALUE);
    }

}
