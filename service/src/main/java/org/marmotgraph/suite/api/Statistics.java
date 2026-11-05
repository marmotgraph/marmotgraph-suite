package org.marmotgraph.suite.api;

import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.GraphStatistics;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Provides the key figures of the graph - the core restricts them to the spaces the user can read.
 */
@RestController
@RequestMapping("/statistics")
public class Statistics {

    @GetMapping
    public GraphStatistics get(@AuthenticatedClient MarmotGraphClient client) {
        return client.statistics().get();
    }

}
