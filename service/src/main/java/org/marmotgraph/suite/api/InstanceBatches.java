package org.marmotgraph.suite.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.BatchJob;
import org.marmotgraph.sdk.model.BatchJobItem;
import org.marmotgraph.sdk.resources.BatchOptions;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Deletes, releases and unreleases several instances at once - on behalf of the user who issued the request. The core
 * processes the instances set-based (a server-side batch), which is much faster than one request per instance. The
 * request returns once the batch is done; the instances succeed or fail on their own. The core rejects the whole batch
 * if the user isn't allowed to carry out the operation on a single one of the instances.
 */
@RestController
@RequestMapping("/instances/batch")
public class InstanceBatches {

    /**
     * The outcome for a single instance of a batch.
     *
     * @param code  the status code the core rejected the instance with - null if it succeeded (or the core didn't provide one)
     * @param error the reason why the instance failed - null if it succeeded
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record BatchItemOutcome(String instanceId, boolean succeeded, Integer code, String error) {
    }

    /**
     * The outcome of a batch.
     *
     * @param items the outcome per instance - in the order the instances were sent
     */
    public record BatchOutcome(int succeeded, int failed, List<BatchItemOutcome> items) {
    }

    /**
     * Deletes the instances. Released instances (including ones released and then changed) are unreleased first, so
     * they are also removed from search - this requires the permission to release them in addition to deleting them.
     *
     * @param ids the uuids of the instances as known by the core
     */
    @PostMapping("/delete")
    public BatchOutcome delete(@AuthenticatedClient MarmotGraphClient client, @RequestBody List<UUID> ids) {
        return run(ids, i -> client.batch().delete(i, true, BatchOptions.DEFAULT));
    }

    /**
     * Releases the current state of the instances.
     *
     * @param ids the uuids of the instances as known by the core
     */
    @PostMapping("/release")
    public BatchOutcome release(@AuthenticatedClient MarmotGraphClient client, @RequestBody List<UUID> ids) {
        return run(ids, i -> client.batch().release(i));
    }

    /**
     * Removes the released versions of the instances.
     *
     * @param ids the uuids of the instances as known by the core
     */
    @PostMapping("/unrelease")
    public BatchOutcome unrelease(@AuthenticatedClient MarmotGraphClient client, @RequestBody List<UUID> ids) {
        return run(ids, i -> client.batch().unrelease(i));
    }

    private static BatchOutcome run(List<UUID> ids, Function<List<UUID>, BatchJob> batch) {
        if (ids.isEmpty()) {
            return new BatchOutcome(0, 0, List.of());
        }
        return outcome(ids, batch.apply(ids));
    }

    /**
     * The outcome per submitted instance - an instance the job doesn't report on (e.g. since it was interrupted and
     * couldn't be resumed) has failed with the error of the job.
     */
    static BatchOutcome outcome(List<UUID> ids, BatchJob job) {
        Map<Integer, BatchJobItem> byIndex = job.items().stream().collect(Collectors.toMap(BatchJobItem::index, i -> i, (a, b) -> b));
        List<BatchItemOutcome> items = new ArrayList<>();
        for (int index = 0; index < ids.size(); index++) {
            String instanceId = ids.get(index).toString();
            BatchJobItem item = byIndex.get(index);
            if (item != null && item.isSuccess()) {
                items.add(new BatchItemOutcome(instanceId, true, null, null));
            } else if (item != null && item.error() != null) {
                items.add(new BatchItemOutcome(instanceId, false, item.error().code(), item.error().message()));
            } else {
                items.add(new BatchItemOutcome(instanceId, false, null, notProcessed(item, job)));
            }
        }
        int succeeded = (int) items.stream().filter(BatchItemOutcome::succeeded).count();
        return new BatchOutcome(succeeded, items.size() - succeeded, items);
    }

    private static String notProcessed(BatchJobItem item, BatchJob job) {
        String reason = item != null && item.status() != null ? "The instance hasn't been processed (" + item.status() + ")" : "The instance hasn't been processed";
        return job.error() != null && !job.error().isBlank() ? reason + ": " + job.error() : reason;
    }
}
