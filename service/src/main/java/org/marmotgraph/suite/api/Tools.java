package org.marmotgraph.suite.api;

import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Tool;
import org.marmotgraph.sdk.model.ToolCategory;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The tools built on top of the graph (e.g. a search or a dashboard) which are listed to the user who issued the request
 * - the core decides which ones by the claims of the user. They are user specific and therefore not part of the
 * (public) configuration.
 */
@RestController
@RequestMapping("/tools")
public class Tools {

    /**
     * A category with the tools listed in it.
     *
     * @param icon the markup of the SVG icon - null if there is none
     */
    public record CategoryWithTools(UUID id, String name, String icon, List<Tool> tools) {
    }

    /**
     * The categories (sorted by name) with the tools of the user (sorted by name) - categories without tools are left
     * out (the core lists them to users who define tools).
     */
    @GetMapping
    public List<CategoryWithTools> list(@AuthenticatedClient MarmotGraphClient client) {
        Map<UUID, List<Tool>> toolsByCategory = client.tools().list().stream()
                .filter(t -> t.category() != null)
                .collect(Collectors.groupingBy(t -> t.category().id()));
        return client.tools().listCategories().stream()
                .filter(c -> toolsByCategory.containsKey(c.id()))
                .map(c -> category(c, toolsByCategory.get(c.id())))
                .toList();
    }

    private static CategoryWithTools category(ToolCategory category, List<Tool> tools) {
        return new CategoryWithTools(category.id(), category.name(), category.icon(), tools);
    }

}
