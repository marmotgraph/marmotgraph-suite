package org.marmotgraph.suite.api;

import org.marmotgraph.sdk.MarmotGraphApiException;
import org.marmotgraph.suite.configuration.CoreUnavailableException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Translates the errors of the MarmotGraph core (reported by the SDK) into responses of the suite API - e.g. an
 * expired token is reported as 401 to the client instead of an internal server error.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MarmotGraphApiException.class)
    public ProblemDetail handle(MarmotGraphApiException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(e.statusCode()), e.message());
    }

    /** Reported as 503 with the interval after which the client should try again (in seconds, also as Retry-After header). */
    @ExceptionHandler(CoreUnavailableException.class)
    public ResponseEntity<ProblemDetail> handle(CoreUnavailableException e) {
        long retryInterval = e.getRetryInterval().toSeconds();
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        problem.setTitle("MarmotGraph core unavailable");
        problem.setProperty("retryInterval", retryInterval);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(retryInterval))
                .body(problem);
    }

}
