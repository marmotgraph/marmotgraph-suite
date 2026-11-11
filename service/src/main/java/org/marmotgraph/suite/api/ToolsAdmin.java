package org.marmotgraph.suite.api;

import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.ToolCategory;
import org.marmotgraph.sdk.model.ToolDefinition;
import org.marmotgraph.sdk.model.ToolSpecification;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Manages the tools built on top of the graph and the categories they are listed in - on behalf of the user who issued
 * the request (who needs DEFINE_TOOLS in the core). The core validates the definitions (e.g. the endpoint and the icon).
 */
@RestController
@RequestMapping("/admin/tools")
public class ToolsAdmin {

    /**
     * @param icon the markup of a self-contained SVG icon - null for none
     */
    public record CategorySpecification(String name, String icon) {
    }

    /**
     * All categories (sorted by name) - including the ones without tools.
     */
    @GetMapping("/categories")
    public List<ToolCategory> listCategories(@AuthenticatedClient MarmotGraphClient client) {
        return client.tools().listCategories();
    }

    @PostMapping("/categories")
    public ToolCategory createCategory(@AuthenticatedClient MarmotGraphClient client, @RequestBody CategorySpecification specification) {
        return client.tools().createCategory(specification.name(), blankToNull(specification.icon()));
    }

    /**
     * Replaces the name and the icon of the category - the icon is removed if none is provided.
     */
    @PutMapping("/categories/{id}")
    public ToolCategory updateCategory(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id,
                                       @RequestBody CategorySpecification specification) {
        return client.tools().updateCategory(id, specification.name(), blankToNull(specification.icon()));
    }

    /**
     * Removes the category - the core rejects it (409) as long as it has tools.
     */
    @DeleteMapping("/categories/{id}")
    public void deleteCategory(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        client.tools().deleteCategory(id);
    }

    /**
     * The definitions of all tools including their claims.
     */
    @GetMapping("/definitions")
    public List<ToolDefinition> listDefinitions(@AuthenticatedClient MarmotGraphClient client) {
        return client.tools().listDefinitions();
    }

    @PostMapping("/definitions")
    public ToolDefinition create(@AuthenticatedClient MarmotGraphClient client, @RequestBody ToolSpecification specification) {
        return client.tools().create(specification);
    }

    @PutMapping("/definitions/{id}")
    public ToolDefinition update(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id,
                                 @RequestBody ToolSpecification specification) {
        return client.tools().update(id, specification);
    }

    @DeleteMapping("/definitions/{id}")
    public void delete(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        client.tools().delete(id);
    }

    private static String blankToNull(String value) {
        return value != null && !value.isBlank() ? value : null;
    }

}
