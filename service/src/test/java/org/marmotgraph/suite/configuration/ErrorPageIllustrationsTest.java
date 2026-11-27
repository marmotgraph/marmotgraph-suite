package org.marmotgraph.suite.configuration;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The static error pages can't load the assets of the UI - they contain a copy of its illustrations instead. This test
 * fails as soon as a copy is outdated: the opening tag of the copy is adjusted for the page (class, aria-hidden, no
 * fixed size), everything else - the viewBox and the drawing with its animations - has to match the asset.
 */
class ErrorPageIllustrationsTest {

    private static final Path PAGES = Path.of("src/main/resources/static/error");
    // Maven runs the tests in the service folder - the UI lives next to it in the repository
    private static final Path ASSETS = Path.of("../ui/src/assets");

    private static final Pattern SVG = Pattern.compile("(<svg\\b[^>]*>)(.*?</svg>)", Pattern.DOTALL);
    private static final Pattern VIEW_BOX = Pattern.compile("viewBox=\"([^\"]*)\"");

    @ParameterizedTest(name = "{0} shows {1}")
    @CsvSource({
            "404.html, marmot-404.svg",
            "4xx.html, marmot-400.svg",
            "5xx.html, marmot-error.svg"
    })
    void theIllustrationIsACopyOfTheAsset(String page, String asset) throws IOException {
        String html = Files.readString(PAGES.resolve(page));
        String marker = "A copy of ui/src/assets/" + asset;
        int copyAt = html.indexOf(marker);
        assertTrue(copyAt >= 0, page + " is expected to mark its illustration with \"" + marker + "\"");

        Matcher copy = SVG.matcher(html);
        assertTrue(copy.find(copyAt), page + " has no illustration after \"" + marker + "\"");
        Matcher original = SVG.matcher(Files.readString(ASSETS.resolve(asset)));
        assertTrue(original.find(), asset + " contains no svg");

        String outdated = page + " contains an outdated copy of " + asset + " - copy the content of the asset into the page again";
        assertEquals(viewBox(original.group(1)), viewBox(copy.group(1)), outdated);
        assertEquals(original.group(2), copy.group(2), outdated);
    }

    private static String viewBox(String openingTag) {
        Matcher viewBox = VIEW_BOX.matcher(openingTag);
        return viewBox.find() ? viewBox.group(1) : null;
    }

}
