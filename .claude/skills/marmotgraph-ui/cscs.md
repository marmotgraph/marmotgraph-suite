# CSCS tenant style

The suite has one default style (the Editor visual system in [reference.md](reference.md)) and, for the tenant CSCS, an optional second style. The default is never changed for a tenant. A tenant without its own style gets the default.

## How it works

| Part | File |
| --- | --- |
| Registry of tenant styles, loads the stylesheet on demand, sets `data-tenant` on `<html>` | `ui/src/tenants/tenantStyles.ts` (called from `ConfigContext.tsx` before the UI is shown) |
| Tokens, shell, sidebar, top bar, buttons, forms, tables, tags, home screen | `ui/src/tenants/cscs/cscs.css` |
| The apps: Editor, Query Builder, Visualizer, Modeler, Statistics, Admin | `ui/src/tenants/cscs/apps.css` (imported by `cscs.css`) |
| Test of the loader | `ui/src/tenants/tenantStyles.test.ts` |

The tenant name comes from the config (`useConfig().tenant`) and is matched in lower case (`CSCS` and `cscs` are the same). A tenant without an entry in `TENANT_STYLES` keeps the default.

## Rules

1. **Scope.** Every selector starts with `html[data-tenant="cscs"]`. Nothing outside that scope belongs in these files.
2. **Default stays as it is.** Do not edit a default stylesheet or a component to make CSCS look different. If the default has a real bug, fix it there on purpose and say so. Otherwise override in the CSCS files.
3. **Tokens.** Use the `--cscs-*` variables from the first block of `cscs.css`. Do not write a color or a radius twice.
4. **Override, don't fight.** The app stylesheets hard-code colors and use `!important` in places. Match the specificity (the `html[data-tenant]` prefix adds one class) and add `!important` only where the default has it.
5. **New app, new component.** If a stylesheet adds a purple (`#5b5fc7`, `#eef0fb`, `#e8e9f3`), blue (`#2563EB`, `#6c8ebf`) or a radius of 10px or more, add its selector to `apps.css` in the same change. A grep for those values over `ui/src` finds the gaps.
6. **Tenant loading is invisible.** The UI waits for the style before the first render, so nobody sees the default style flash. A style that fails to load falls back to the default.

## Tokens (`cscs.css`, section 1)

| Token | Value | Use |
| --- | --- | --- |
| `--cscs-brand` | `#3a6b20` | links, focus, checked, hover accent, icons |
| `--cscs-brand-hover` | `#2b5416` | link hover |
| `--cscs-brand-tint` / `-tint-text` | `#eef5ea` / `#243a1a` | selected row, active mode or tab, pills |
| `--cscs-brand-ring` | green at 22% | focus ring around fields |
| `--cscs-page` | `#fafbfd` | page and table header band |
| `--cscs-surface` | `#fff` | cards, canvas of lists, top bar, sidebar |
| `--cscs-hover` | `#f5f6f9` | hover and active nav |
| `--cscs-border` / `-border-strong` | `#e8eaee` / `#d6dae1` | card edge / control edge |
| `--cscs-table-line` / `-table-edge` | `#f1f3f5` / `#eceef1` | row rule / table card edge |
| `--cscs-text`, `-text-body`, `-text-muted`, `-text-faint` | `#101620`, `#344054`, `#6b7280`, `#8a8f98` | titles, body, meta, table headers |
| `--cscs-radius` | 6px | buttons, inputs, nav items, nested cards |
| `--cscs-radius-card` | 8px | cards, panels, dialogs, the list card |
| pills, badges, tags | 999px | status and filter pills |

The values come from the CSCS console screenshots. If a new screenshot disagrees, change the token, not the rules.

## What the CSCS style looks like

- **Shell.** White sidebar with a hairline on its right, a full-window canvas on `#fafbfd` (no rounded floating card), a slim white top bar with a hairline below, a white footer with a hairline above. The sidebar logo is 70% wide, at most 170px.
- **Titles.** The top bar names the module. The title of a list ("Instances", "Queries", "Statistics") is a 1.25rem section heading, not a second page title. The home screen keeps its large title (tenant name plus "Knowledge Graph Suite").
- **Buttons.** 6px radius, weight 500. Quiet actions are white with a hairline. The dark primary action keeps the default dark (no CSCS reference for an enabled primary yet).
- **Lists.** Rows are white with a hairline between them, no zebra stripes. The header row is a light band. The list sits in a white card with a hairline edge (not on a phone). Hover is the page tone, selection is the green tint with a green bar.
- **Permission buttons.** One row of four, or a 2 x 2 grid when the list is 900px wide or less (a container query), so they never wrap by accident. The column is headed "Actions".
- **Color.** Green is the only accent. Purple hover and selection, and the blue of links and focus rings, are remapped to green. Status colors keep their meaning: released green, changed and unsaved amber, contribution blue, errors red.
- **Cards.** 8px radius and `--cscs-border`. Cards inside a card use 6px.

## Coverage by app (`apps.css`)

| App | Covered |
| --- | --- |
| Home | boxes, documentation strip (`cscs.css`) |
| Editor | list card, rows, permission buttons, filters and pills, preview, cards of the mobile list, detail header card, mode buttons, links panel, highlighted link, unsaved rail focus, dialogs |
| Query Builder | table, tree rows (hover and selected), alias link, focus |
| Visualizer | panels, layout picker, results, neighbours, chips, "more" link, canvas focus, empty state |
| Modeler | type list, selection, links, drop indicator, selected node, schema and preview boxes, fields focus |
| Statistics | cards, "show all" link |
| Admin | tenant list and selection, space cards, form focus |
| Shared | focus ring, field focus, links, dialogs and tooltips, breadcrumbs, dropdown menus |

Not restyled on purpose: type colors (they come from the data), graph edges and ports, status pairs, the contribution pill.

## Known gaps

- No CSCS reference yet for: an enabled primary button, a danger button, a modal, the tabs of a detail page beyond the active mode button, charts, empty states, a file upload. Ask for a screenshot before inventing one.
- The code was checked by building and by the unit tests. A pass in the browser at desktop and phone width is still open for every app other than the Editor list.

## Before you finish a UI change

```
- [ ] The default style is unchanged (no edit to a default stylesheet just for CSCS)
- [ ] New purple, blue, or 10px+ radius: its selector is in apps.css
- [ ] New CSCS rules are scoped to html[data-tenant="cscs"] and use --cscs-* tokens
- [ ] Looked at the change with and without data-tenant="cscs" on <html>
- [ ] This file still describes what the CSCS style does
```
