package org.marmotgraph.suite.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Provides the instances shown in the editor.
 * <p>
 * TODO this is a dummy implementation returning mock data - to be replaced by requests to the MarmotGraph core
 * (on behalf of the user who issued the request).
 */
@RestController
@RequestMapping("/instances")
public class Instances {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LinkedInstance(String instanceId, String instanceName, String type, String space, String fieldLabel,
                                 Boolean hasDirectLinks, Boolean hasReverseLinks) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Instance(int id, String instanceId, String type, String instanceName, String space,
                           String permissions, boolean bookmarked, String lastVisited, String releaseStatus) {
    }

    private static final String RELEASED = "released";
    private static final String IN_PROGRESS = "in progress";

    private static final List<Instance> MOCK_INSTANCES = List.of(
            new Instance(1, "inst-47b94e45-5435-49a8-aba3-3d482fabced3", "Appliance", "Server-Rack-A1", "private-25ae0198-753b-497d-9163-67488442f64", "View, Edit, Review, Release", true, "2026-04-18", RELEASED),
            new Instance(2, "inst-a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d", "Building", "Data Center North", "shared-infrastructure-workspace", "View", false, null, IN_PROGRESS),
            new Instance(3, "inst-302a3695-722c-4e29-9543-8f6a7b8c9d0e", "Cabinet", "Storage-Cabinet-B3", "private-302a3695-722c-4e29-9543-8f6a", "View, Edit, Review", true, "2026-04-20", RELEASED),
            new Instance(4, "inst-b2c3d4e5-f6a7-4b5c-8d9e-0f1a2b3c4d5e", "Blade", "Compute-Blade-12", "team-compute-ops", "View, Edit, Release", false, null, RELEASED),
            new Instance(5, "inst-c3d4e5f6-a7b8-4c5d-9e0f-1a2b3c4d5e6f", "Asset Tag", "Asset-2023-1547", "private-25ae0198-753b-497d-9163-67488442f64", "View", true, "2026-04-15", IN_PROGRESS),
            new Instance(6, "inst-d4e5f6a7-b8c9-4d5e-0f1a-2b3c4d5e6f7a", "Building", "Office Complex Alpha", "shared-facilities-workspace", "View, Review", false, null, RELEASED),
            new Instance(7, "inst-7f8e9d0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a", "Appliance", "Network-Switch-Core-1", "private-7f8e9d0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a", "View, Edit", true, "2026-04-21", IN_PROGRESS),
            new Instance(8, "inst-e5f6a7b8-c9d0-4e5f-1a2b-3c4d5e6f7a8b", "Cabinet", "Server-Cabinet-C5", "team-infrastructure-ops", "View", false, null, RELEASED),
            new Instance(9, "inst-f6a7b8c9-d0e1-4f5a-2b3c-4d5e6f7a8b9c", "Canton", "Zurich-Site-Main", "shared-location-workspace", "View, Edit, Share", true, null, RELEASED),
            new Instance(10,"inst-a7b8c9d0-e1f2-4a5b-3c4d-5e6f7a8b9c0d", "Blade", "GPU-Blade-Tesla-8", "private-25ae0198-753b-497d-9163-67488442f64", "View, Edit", false, "2026-04-19", IN_PROGRESS)
    );

    @GetMapping
    public List<Instance> list(@AuthenticatedClient MarmotGraphClient client) {
        return MOCK_INSTANCES;
    }

}
