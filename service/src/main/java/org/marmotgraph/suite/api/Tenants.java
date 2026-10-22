package org.marmotgraph.suite.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.marmotgraph.sdk.MarmotGraphClient;
import org.marmotgraph.sdk.model.JsonLdDocument;
import org.marmotgraph.suite.auth.AuthenticatedClient;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Manages the tenants of the MarmotGraph core (their definition and theme) - on behalf of the user who issued the
 * request (who needs the rights to manage tenants in the core for the modifications).
 * <p>
 * The core doesn't provide the font and colors of a tenant individually but only the stylesheet generated from them -
 * they are therefore parsed from this stylesheet (see {@link #theme(String)}).
 */
@RestController
@RequestMapping("/admin/tenants")
public class Tenants {

    /**
     * The tenant which is provided by the core as fallback - it can not be modified.
     */
    static final String DEFAULT_TENANT = "default";

    private static final Pattern TENANT_NAME = Pattern.compile("[A-Za-z0-9_-]+");
    private static final Pattern FONT_URL = Pattern.compile("@import\\s+url\\((.*?)\\)\\s*;");
    private static final Pattern FONT_FAMILY = Pattern.compile("font-family\\s*:\\s*(.*?)\\s*;");
    private static final Pattern CSS_VARIABLE = Pattern.compile("(--[\\w-]+)\\s*:\\s*(.*?)\\s*;");
    private static final String COLORS_BLOCK = ":root {";

    /**
     * The color scheme of the core (group -> color -> CSS variable of the generated stylesheet) - in the order of display.
     */
    static final Map<String, Map<String, String>> COLOR_VARIABLES = new LinkedHashMap<>();

    static {
        COLOR_VARIABLES.put("brandColors", colors("primary", "--brand-primary", "secondary", "--brand-secondary", "tertiary", "--brand-tertiary"));
        COLOR_VARIABLES.put("greys", colors("grey200", "--grey-200", "grey300", "--grey-300", "grey400", "--grey-400", "grey500", "--grey-500",
                "grey600", "--grey-600", "grey700", "--grey-700", "grey800", "--grey-800", "grey900", "--grey-900"));
        COLOR_VARIABLES.put("blacks", colors("black05", "--black-05", "black06", "--black-06", "black07", "--black-07", "black08", "--black-08",
                "black09", "--black-09", "black10", "--black-10"));
        COLOR_VARIABLES.put("stateColors", colors("warning", "--state-warning", "info", "--state-info", "success", "--state-success", "error", "--state-error"));
        COLOR_VARIABLES.put("linkColors", colors("defaultColor", "--link-default", "activeColor", "--link-active", "visitedColor", "--link-visited",
                "disabledColor", "--link-disabled", "hoverColor", "--link-hover"));
    }

    /**
     * The core (currently) misspells the variable of the secondary brand color - both spellings are accepted.
     */
    private static final Map<String, String> VARIABLE_ALIASES = Map.of("--brand-seconday", "--brand-secondary");

    public enum Image {logo, background, favicon}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TenantDefinition(String title, String contactEmail, String copyright) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Font(String url, String fontFamily) {
    }

    /**
     * The customizations of a tenant - the colors are grouped as in the color scheme of the core (see {@link #COLOR_VARIABLES}).
     */
    public record Theme(Font font, Map<String, Map<String, String>> colors, String customCss) {
    }

    /**
     * @param css      the resulting stylesheet of the tenant as provided by the core (generated from its theme)
     * @param editable false for the default tenant which can not be modified
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Tenant(String name, String title, String contactEmail, String copyright, String idNamespace, Theme theme, String css,
                         boolean editable) {
    }

    @GetMapping
    public List<String> list(@AuthenticatedClient MarmotGraphClient client) {
        return client.tenants().list();
    }

    /**
     * The definition and theme of the tenant - the core falls back to its defaults for anything not defined (yet).
     */
    @GetMapping("/{name}")
    public Tenant get(@AuthenticatedClient MarmotGraphClient client, @PathVariable String name) {
        validateName(name);
        JsonLdDocument definition = client.tenants().get(name);
        String css = client.tenants().getCss(name);
        return new Tenant(name, string(definition.get("title")), string(definition.get("contactEmail")), string(definition.get("copyright")),
                string(definition.get("idNamespace")), theme(css), css, !DEFAULT_TENANT.equals(name));
    }

    /**
     * Creates the tenant - or updates its definition if it already exists.
     */
    @PutMapping("/{name}")
    public void define(@AuthenticatedClient MarmotGraphClient client, @PathVariable String name, @RequestBody TenantDefinition definition) {
        validateName(name);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", definition.title());
        body.put("contactEmail", definition.contactEmail());
        body.put("copyright", definition.copyright());
        client.tenants().define(name, body);
    }

    @PutMapping("/{name}/theme/font")
    public void setFont(@AuthenticatedClient MarmotGraphClient client, @PathVariable String name, @RequestBody Font font) {
        validateName(name);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("url", font.url());
        body.put("fontFamily", font.fontFamily());
        client.tenants().setFont(name, body);
    }

    /**
     * Replaces the color scheme of the tenant - all colors of the scheme are required by the core (see {@link #COLOR_VARIABLES}).
     */
    @PutMapping("/{name}/theme/colors")
    public void setColors(@AuthenticatedClient MarmotGraphClient client, @PathVariable String name,
                          @RequestBody Map<String, Map<String, String>> colors) {
        validateName(name);
        Map<String, Object> body = new LinkedHashMap<>();
        COLOR_VARIABLES.forEach((group, variables) -> {
            Map<String, String> values = colors.getOrDefault(group, Map.of());
            Map<String, Object> groupBody = new LinkedHashMap<>();
            for (String color : variables.keySet()) {
                String value = values.get(color);
                if (value == null || value.isBlank()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.format("The color %s.%s is missing", group, color));
                }
                groupBody.put(color, value.trim());
            }
            body.put(group, groupBody);
        });
        client.tenants().setColors(name, body);
    }

    @PutMapping(value = "/{name}/theme/customCss", consumes = MediaType.TEXT_PLAIN_VALUE)
    public void setCustomCss(@AuthenticatedClient MarmotGraphClient client, @PathVariable String name, @RequestBody(required = false) String css) {
        validateName(name);
        client.tenants().setCustomCss(name, css != null ? css : "");
    }

    /**
     * Uploads an image of the theme of the tenant - logos and background images are defined for the dark and bright mode
     * individually (the dark mode is ignored for the favicon).
     */
    @PutMapping(value = "/{name}/theme/{image}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public void setImage(@AuthenticatedClient MarmotGraphClient client, @PathVariable String name, @PathVariable Image image,
                         @RequestParam(defaultValue = "true") boolean darkMode, @RequestPart("file") MultipartFile file) throws IOException {
        validateName(name);
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The uploaded file is empty");
        }
        byte[] content = file.getBytes();
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : image.name();
        String contentType = file.getContentType() != null ? file.getContentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        switch (image) {
            case logo -> client.tenants().setLogo(name, content, filename, contentType, darkMode);
            case background -> client.tenants().setBackground(name, content, filename, contentType, darkMode);
            case favicon -> client.tenants().setFavicon(name, content, filename, contentType);
        }
    }

    /**
     * Parses the stylesheet generated by the core for a tenant - it consists of the font (an optional import and the
     * font family), the colors (as variables of the ":root" block) and the custom CSS (anything after the colors).
     */
    static Theme theme(String css) {
        String content = css != null ? css : "";
        int colorsStart = content.indexOf(COLORS_BLOCK);
        int colorsEnd = colorsStart >= 0 ? content.indexOf('}', colorsStart) : -1;
        String fontPart = colorsStart >= 0 ? content.substring(0, colorsStart) : "";
        String colorsPart = colorsEnd >= 0 ? content.substring(colorsStart, colorsEnd) : "";
        String customCss = colorsEnd >= 0 ? content.substring(colorsEnd + 1).strip() : content.strip();

        Matcher url = FONT_URL.matcher(fontPart);
        Matcher family = FONT_FAMILY.matcher(fontPart);
        Font font = new Font(url.find() ? url.group(1).trim() : null, family.find() ? family.group(1) : null);

        Map<String, String> variables = new LinkedHashMap<>();
        Matcher variable = CSS_VARIABLE.matcher(colorsPart);
        while (variable.find()) {
            variables.put(VARIABLE_ALIASES.getOrDefault(variable.group(1), variable.group(1)), variable.group(2));
        }
        Map<String, Map<String, String>> colors = new LinkedHashMap<>();
        COLOR_VARIABLES.forEach((group, groupVariables) -> {
            Map<String, String> values = new LinkedHashMap<>();
            groupVariables.forEach((color, cssVariable) -> values.put(color, variables.get(cssVariable)));
            colors.put(group, values);
        });
        return new Theme(font, colors, customCss);
    }

    /**
     * Tenant names are used as path segment in the requests to the core - they are therefore restricted to a safe set of
     * characters.
     */
    private static void validateName(String name) {
        if (name == null || !TENANT_NAME.matcher(name).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tenant names may only contain letters, digits, \"-\" and \"_\"");
        }
    }

    private static Map<String, String> colors(String... colorsAndVariables) {
        Map<String, String> result = new LinkedHashMap<>();
        for (int i = 0; i < colorsAndVariables.length; i += 2) {
            result.put(colorsAndVariables[i], colorsAndVariables[i + 1]);
        }
        return result;
    }

    private static String string(Object value) {
        return value != null ? value.toString() : null;
    }

}
