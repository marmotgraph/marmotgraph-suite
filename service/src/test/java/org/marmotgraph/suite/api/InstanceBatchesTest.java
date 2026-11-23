package org.marmotgraph.suite.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.BatchItemStatus;
import org.marmotgraph.sdk.model.BatchJob;
import org.marmotgraph.sdk.model.BatchJobItem;
import org.marmotgraph.sdk.model.BatchJobStatus;
import org.marmotgraph.sdk.model.BatchOperation;
import org.marmotgraph.sdk.resources.BatchOptions;
import org.marmotgraph.sdk.resources.BatchResource;
import org.marmotgraph.suite.auth.AuthenticatedClientResolver;
import org.marmotgraph.suite.configuration.ArgumentResolvers;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitWebConfig(InstanceBatchesTest.TestConfig.class)
class InstanceBatchesTest {

    @EnableWebMvc
    @Import({InstanceBatches.class, ApiExceptionHandler.class, AuthenticatedClientResolver.class, ArgumentResolvers.class})
    static class TestConfig {
        @Bean
        MarmotGraphClient marmotGraphClient() {
            return Mockito.mock(MarmotGraphClient.class);
        }
    }

    private static final UUID FIRST = UUID.fromString("47b94e45-5435-49a8-aba3-3d482fabced3");
    private static final UUID SECOND = UUID.fromString("a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d");
    private static final String BODY = "[\"" + FIRST + "\", \"" + SECOND + "\"]";

    @Autowired
    private MarmotGraphClient client;

    private BatchResource batchResource;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        Mockito.reset(client);
        MarmotGraphClient userClient = Mockito.mock(MarmotGraphClient.class);
        batchResource = Mockito.mock(BatchResource.class);
        when(client.withToken("theToken")).thenReturn(userClient);
        when(userClient.batch()).thenReturn(batchResource);
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    private static BatchJob job(BatchOperation operation, BatchJobStatus status, String error, BatchJobItem... items) {
        int succeeded = (int) List.of(items).stream().filter(BatchJobItem::isSuccess).count();
        return new BatchJob(UUID.randomUUID(), operation, status, false, 2, items.length, succeeded, items.length - succeeded,
                Instant.now(), Instant.now(), Instant.now(), error, List.of(items));
    }

    @Test
    void deleteUnreleasesReleasedInstancesAndReportsTheOutcomePerInstance() throws Exception {
        when(batchResource.delete(List.of(FIRST, SECOND), true, BatchOptions.DEFAULT)).thenReturn(job(BatchOperation.DELETE, BatchJobStatus.COMPLETED, null,
                new BatchJobItem(0, FIRST, BatchItemStatus.DELETED, null),
                new BatchJobItem(1, SECOND, BatchItemStatus.FAILED, new BatchJobItem.Error(403, "Not allowed to delete"))));

        mockMvc.perform(post("/instances/batch/delete").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.succeeded").value(1))
                .andExpect(jsonPath("$.failed").value(1))
                .andExpect(jsonPath("$.items[0].instanceId").value(FIRST.toString()))
                .andExpect(jsonPath("$.items[0].succeeded").value(true))
                .andExpect(jsonPath("$.items[0].error").doesNotExist())
                .andExpect(jsonPath("$.items[1].instanceId").value(SECOND.toString()))
                .andExpect(jsonPath("$.items[1].succeeded").value(false))
                .andExpect(jsonPath("$.items[1].code").value(403))
                .andExpect(jsonPath("$.items[1].error").value("Not allowed to delete"));
    }

    @Test
    void releaseAndUnreleaseAreCarriedOutInABatch() throws Exception {
        when(batchResource.release(List.of(FIRST, SECOND))).thenReturn(job(BatchOperation.RELEASE, BatchJobStatus.COMPLETED, null,
                new BatchJobItem(0, FIRST, BatchItemStatus.RELEASED, null), new BatchJobItem(1, SECOND, BatchItemStatus.RELEASED, null)));
        when(batchResource.unrelease(List.of(FIRST))).thenReturn(job(BatchOperation.UNRELEASE, BatchJobStatus.COMPLETED, null,
                new BatchJobItem(0, FIRST, BatchItemStatus.UNRELEASED, null)));

        mockMvc.perform(post("/instances/batch/release").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.succeeded").value(2))
                .andExpect(jsonPath("$.failed").value(0));
        mockMvc.perform(post("/instances/batch/unrelease").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("[\"" + FIRST + "\"]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].succeeded").value(true));
    }

    @Test
    void anEmptyBatchIsNotSentToTheCore() throws Exception {
        mockMvc.perform(post("/instances/batch/release").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content("[]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        verifyNoInteractions(batchResource);
    }

    @Test
    void aRejectedBatchIsReportedWithTheStatusOfTheCore() throws Exception {
        when(batchResource.release(List.of(FIRST, SECOND))).thenThrow(new MarmotGraphApiException(401, "Not allowed to release an instance", null, null));

        mockMvc.perform(post("/instances/batch/release").header(HttpHeaders.AUTHORIZATION, "Bearer theToken")
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void instancesWhichHaveNotBeenProcessedHaveFailed() {
        BatchJob interrupted = job(BatchOperation.RELEASE, BatchJobStatus.FAILED, "The server has been restarted",
                new BatchJobItem(0, FIRST, BatchItemStatus.RELEASED, null), new BatchJobItem(1, SECOND, BatchItemStatus.NOT_PROCESSED, null));

        InstanceBatches.BatchOutcome outcome = InstanceBatches.outcome(List.of(FIRST, SECOND), interrupted);

        assertEquals(1, outcome.succeeded());
        assertEquals(1, outcome.failed());
        InstanceBatches.BatchItemOutcome second = outcome.items().get(1);
        assertFalse(second.succeeded());
        assertEquals("The instance hasn't been processed (NOT_PROCESSED): The server has been restarted", second.error());
    }
}
