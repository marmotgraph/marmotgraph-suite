import { json } from "@codemirror/lang-json";

/** The configuration of the CodeMirror editors showing JSON values */
export const jsonExtensions = [json()];
export const jsonEditorSetup = { lineNumbers: false, foldGutter: true, highlightActiveLine: false };
