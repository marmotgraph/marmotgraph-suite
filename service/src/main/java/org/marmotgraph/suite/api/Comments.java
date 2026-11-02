package org.marmotgraph.suite.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.Comment;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Provides the comments of the reviewers on an instance and its properties - on behalf of the user who issued the
 * request. The core rejects the requests of users without the permission to comment.
 */
@RestController
@RequestMapping("/instances/{id}/comments")
public class Comments {

    /** The author of a comment - the name falls back to the username. */
    public record Author(String username, String name) {
    }

    /**
     * A comment as shown in the editor.
     *
     * @param property  the property the comment is about - null if it is about the instance as a whole
     * @param updatedAt the time of the last edit (ISO-8601) - null if the comment has never been edited
     * @param own       whether the comment has been written by the current user
     * @param createdBy the author - null if the user may not see who has written the comment
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CommentDetail(String id, String property, String text, String createdAt, String updatedAt, boolean own, Author createdBy) {

        static CommentDetail of(Comment comment) {
            Comment.Author author = comment.createdBy();
            return new CommentDetail(comment.id().toString(), comment.property(), comment.text(), isoString(comment.createdAt()), isoString(comment.updatedAt()), comment.own(),
                    author == null ? null : new Author(author.username(), author.name() != null && !author.name().isBlank() ? author.name() : author.username()));
        }

        private static String isoString(Instant instant) {
            return instant != null ? instant.toString() : null;
        }
    }

    /** The new comment - about the instance as a whole if no property is given. */
    public record NewComment(String property, String text) {
    }

    /** The new text of a comment. */
    public record CommentUpdate(String text) {
    }

    /**
     * @param id the uuid of the instance as known by the core
     * @return the comments on the instance and its properties, the oldest first
     */
    @GetMapping
    public List<CommentDetail> list(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id) {
        return client.instances().listComments(id).stream().map(CommentDetail::of).toList();
    }

    /**
     * @param id the uuid of the instance as known by the core
     */
    @PostMapping
    public CommentDetail add(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id, @RequestBody NewComment comment) {
        return CommentDetail.of(client.instances().addComment(id, comment.property(), requireText(comment.text())));
    }

    /**
     * Replaces the text of a comment - the core rejects the request if the user is not its author.
     *
     * @param id        the uuid of the instance as known by the core
     * @param commentId the id of the comment
     */
    @PutMapping("/{commentId}")
    public CommentDetail update(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id, @PathVariable UUID commentId, @RequestBody CommentUpdate update) {
        return CommentDetail.of(client.instances().updateComment(id, commentId, requireText(update.text())));
    }

    /**
     * Deletes a comment - the core rejects the request unless the user is its author or manages the space.
     *
     * @param id        the uuid of the instance as known by the core
     * @param commentId the id of the comment
     */
    @DeleteMapping("/{commentId}")
    public void delete(@AuthenticatedClient MarmotGraphClient client, @PathVariable UUID id, @PathVariable UUID commentId) {
        client.instances().deleteComment(id, commentId);
    }

    private static String requireText(String text) {
        if (text == null || text.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A comment needs a text");
        }
        return text;
    }
}
