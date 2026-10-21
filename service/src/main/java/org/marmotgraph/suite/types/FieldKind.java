package org.marmotgraph.suite.types;

import java.util.Map;

/**
 * The kinds of fields the editor of the UI is able to show - translated from the widgets defined for the properties of
 * a type. The values of a field are provided in the shape the kind requires (e.g. a string for {@link #TEXT}, a list
 * of linked instances for {@link #LINKS}).
 */
public enum FieldKind {
    TEXT, TEXTAREA, NUMBER, DATE, DATETIME, TIME, COLOR, CHECKBOX,
    /**
     * A single linked instance
     */
    LINK,
    /**
     * A list of linked instances
     */
    LINKS,
    /**
     * Widgets which are unknown or not (yet) supported by the UI - the value is provided as is
     */
    UNSUPPORTED;

    /**
     * TODO the nested widgets (Nested, SingleNested) as well as InputTextMultiple, InputNumberMultiple and
     * AnnotatedInputText are not supported yet
     */
    private static final Map<String, FieldKind> BY_WIDGET = Map.ofEntries(
            Map.entry("InputText", TEXT),
            Map.entry("TextArea", TEXTAREA),
            Map.entry("InputNumber", NUMBER),
            Map.entry("InputDate", DATE),
            Map.entry("InputDateTime", DATETIME),
            Map.entry("InputTime", TIME),
            Map.entry("InputColor", COLOR),
            Map.entry("CheckBox", CHECKBOX),
            Map.entry("SimpleDropdown", LINK),
            Map.entry("DynamicDropdown", LINKS),
            Map.entry("DynamicTable", LINKS));

    public static FieldKind ofWidget(String widget) {
        return widget == null ? UNSUPPORTED : BY_WIDGET.getOrDefault(widget, UNSUPPORTED);
    }

    public boolean isLink() {
        return this == LINK || this == LINKS;
    }

}
