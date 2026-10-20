package org.marmotgraph.suite.api;

import org.marmotgraph.sdk.MarmotGraphApiException;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
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

}
