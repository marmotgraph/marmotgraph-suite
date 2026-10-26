# Editor visual reference

Source of truth: the CSS below. Use these values when the stylesheet does not already provide a class. Reuse the class when it does.

## Where styles live

| Surface | Stylesheet | Reach for |
| --- | --- | --- |
| Page shell | `ui/src/App.css`, `ui/src/views/Layout.css` | `layout-container`, `layout-content`, `layout-main` |
| Sidebar | `ui/src/components/SidebarMG.css` | `SidebarMG`, `sidebar-nav-link` |
| Page actions | `ui/src/components/composites/AppSubNav.tsx` | subnav `ctas`, `variant: "dark"`, `size: "sm"` |
| Instance list | `ui/src/modules/editor/EditorHome.css` | `editor-home`, `instance-card`, `instance-preview` |
| Table | `ui/src/modules/query-builder/SharedQueries.css` | `shared-queries-table` |
| Search | `ui/src/components/SearchBar.tsx` | `SearchBar` |
| Filters | `InstanceFilterPanel`, `FilterPill`, `FilterPillsOverflow.css` | existing filter components |
| Detail | `ui/src/modules/editor/InstanceDetail.css` | `instance-focus-panel`, `view-label`, `view-value`, `tag-badge` |
| Links | `ui/src/components/InstanceLinksPanel.css` | `instance-links-panel`, `type-group`, `link-item` |
| Connectors | `InstanceDetail.css` (`.instance-link-edge`) | existing connector layer |
| Breadcrumbs | `ui/src/components/Breadcrumbs/Breadcrumbs.css` | `breadcrumbs` |
| Release and validation | `ui/src/components/InstanceRelease.css`, `EditorHome.css` | `release-status`, `instance-validation` |
| Unsaved | `ui/src/components/UnsavedInstancesPanel.css` | `unsaved-instances-panel` |
| Footer | `ui/src/views/PoweredBy.tsx` | leave the credit line as it is |

`ui/src/styles/theme.css` is not the editor palette. Do not retint editor screens with `--bg-primary` or `--accent-color`.

## Color

| Role | Value | Where it shows |
| --- | --- | --- |
| Page background | `#eee` | `#root` in `App.css` |
| Canvas, cards | `#fff` | `layout-content`, focus card, link cards |
| Primary text | `#212529` | instance name, field values |
| Body text | `#333` / `#495057` | table cells, link names, form labels |
| Meta text | `#6c757d` | ids, space, kickers, breadcrumb current |
| Quiet meta | `#868e96` | link meta, field-group labels, counts `#adb5bd` |
| Hairline | `#dee2e6` | card border, table rule, input border |
| Soft fill | `#f1f3f5` / `#f8f9fa` | icon hover, tag fill, neutral status |
| Nested border | `#e4e7eb` | link cards, type groups |
| Link | `#2563EB`, hover `#1D4ED8` | breadcrumbs, text links |
| Selection | hover `#e8e9f3`, selected `#eef0fb`, bar `#5b5fc7` | instance rows and cards |
| Field focus | `#6c8ebf`, ring `rgba(108, 142, 191, 0.25)` | inputs, highlighted link cards |
| Type fallback | `#6c757d` | missing `typeColor` |
| Released | text `#1e7a42`, fill `#e8f6ee`, bar `#2f9e5c` | status pill, validation |
| Changed / unsaved | text `#856404` or `#9a5b00`, fill `#fff4e5` / `#fff8e6` / `#fff3cd`, border `#ffe08a` | banner, badge, pill |
| Incomplete | `#c27c0e`, bar `#f0a33a` | validation under 100% |
| Bulk selection | fill `#e7f3ff`, border `#b3d9ff` | `bulk-actions-bar` |
| Sidebar hover / active | `#f3f4f6` | `sidebar-nav-link` |
| Nav icon | `#6b7280` | sidebar only |

Type color always comes from the instance or type (`typeColor`). The dot, the focus-card top border, the link-card side border, and the active connector share that color.

## Type

Inter, set on `#root`. Weight 400 for body, 500 for table headers and form labels, 600 for names, kickers, and the page title.

| Role | Size | Notes |
| --- | --- | --- |
| List title | `h2` | one per list view |
| Instance name | 1.85rem | detail title, letter-spacing `-0.01em` |
| Preview name | 1.15rem | side preview |
| Card name | 1.05rem | list cards |
| Table header | 1rem, weight 500 | sticky, nowrap |
| Table cell / field value | 0.95rem | |
| Meta, space | 0.8–0.9rem | |
| Kicker | 0.7–0.8rem | uppercase, tracking 0.4–0.5px |
| Id | 0.75rem monospace | ellipsis, copy control |
| Status pill | 0.75rem | radius 999px, padding `2px 8px` |

Percents and other aligned numbers use `font-variant-numeric: tabular-nums`.

## Shape

| Element | Radius | Border | Shadow |
| --- | --- | --- | --- |
| Canvas (`layout-content`) | 20px | none on the shell | none |
| Focus card, preview, list card | 10px | 1px `#dee2e6`; 3px type edge on focus and list cards | focus and preview: `0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)` |
| Link card, type group, side panel | 8px | 1px `#e4e7eb`; 3px type edge on the outer side | `0 1px 2px rgba(16,24,40,0.04)`; hover `0 6px 16px rgba(16,24,40,0.06)` |
| Inputs, banners, icon buttons | 6px | 1px `#dee2e6` on inputs | focus ring only |
| Tags (`tag-badge`, `view-badge`) | 4px | 1px `#dee2e6`, fill `#f8f9fa`, text `#333` | none |
| Status pills, counts | 999px | none | none |
| Menus | 8px | 1px `#E2E8F0` | `0 8px 24px rgba(15,23,42,0.12)` |

Spacing rhythm: 4, 6, 8, 10, 12, 16, 20, 24, 28. Detail columns gap 40px. The link column is 300px, 340px from 1400px, 380px from 1800px. The open record's column caps at 900px. The list preview is 360px.

## Components

### Shell and sidebar

`Layout` wraps every module: `SidebarMG` plus `layout-content`. Expanded sidebar 280px, collapsed 70px. Active and hover nav share `#f3f4f6`; the active item is weight 600. User avatar is a 32px circle, weight 600. Documentation and the user sit at the bottom, above a 32px round collapse control.

### Buttons

The page action is a subnav CTA, `btn btn-dark btn-sm`, label in sentence case. `SearchBar` has the other dark button: magnifying glass plus the word "Search", and Enter submits. Dialog confirmation uses `variant="dark"`; a destructive confirm uses `variant="danger"` (`Delete Selected`, `Clear all` is `outline-danger`). Toolbar and row actions use `edit-icon-btn`.

### List

`editor-home` is a column that fills the canvas. Only the table scrolls. Header cells stick (`instances-table thead th`) with a 1px `#dee2e6` shadow as the rule. Rows use `shared-queries-table`: pointer, transparent until hover, 4px left bar, cell padding `1.25rem 1rem`. Selected rows keep `#eef0fb` even without hover.

A row shows bookmark, type dot and name, instance name, id, "Saved in space …", permission icons, last visited, and status. Status is the release word plus the validation name, icon, bar, and percent.

The result count (`.instances-result-count`) sits just above the table.

### Detail

`instance-focus-panel` holds the open instance. Header order: kicker with type dot, name, id with copy, link-status icon, space. Then a divider (`#dee2e6`) and the fields. View mode uses `view-label` and `view-value` (value underlined by `#f1f3f5`). Linked values are `view-badge` / `tag-badge` with a type dot. Plain values (dates, notes) stay text. "Unsupported fields (n)" is a disclosure under a `#e9ecef` rule.

The mode switch is the icon row: read (eye), edit (pencil), raw (code), release. The current mode uses `edit-icon-btn--active`.

### Links and connectors

Outgoing links are grouped by type beside the field they come from (`instance-links-panel--aligned`). The panel title is a kicker, "Outgoing links (n)", with a collapse chevron. Each `type-group` has a tinted header (`#f8f9fb`), the type dot and name, and a count. Rows inside the group are flat, separated by `#f1f3f5`.

Connectors: default stroke `#b7c0cc` at 1.5px; active stroke `var(--edge-color, #4f78ad)` at 2.25px; dimmed opacity 0.35; unresolved dash `4 4`. Ports are white with a 2px `#7f93ad` stroke. Handles are 9px circles, 2px accent border, white ring. The connector layer does not take clicks (`pointer-events: none`).

A highlighted link card uses fill `#f3f7fc` and a `#6c8ebf` ring. Unresolved cards are dashed and italic.

### Unsaved rail

Fixed to the right edge, `z-index: 1040`, gray shell `#f1f3f5`, left corners radius 8px. Expanded 300px, collapsed 52px with the label set vertical. The count is a `#495057` pill with white text. New fixed UI must leave this rail reachable. Breadcrumb menus stack above it (`z-index: 1600`).

## States

| State | Treatment |
| --- | --- |
| Hover row | `#e8e9f3`, left bar `#5b5fc7` |
| Selected row | `#eef0fb`, same bar, including when hover is unavailable |
| Focus | 2px solid ring, 2px offset, in the color for that surface |
| Disabled | existing Bootstrap disabled treatment; no extra opacity hack |
| Empty | `.links-empty-state`: centered, 0.875rem, padding `24px 12px` |
| Loading | keep the same slots; do not swap the page for a blank spinner |
| Error on a field | Bootstrap invalid border and ring, as in `.json-field.form-control.is-invalid` |
| Copy | existing tooltip: `#212529` background, white text, 4px radius |

## Motion and breakpoints

Transitions stay at or under 0.2s. Wrap new animation in `@media (prefers-reduced-motion: reduce)` and turn it off, as the links panel does.

`768px` is the phone breakpoint. At that width the list preview takes the screen and the table hides, filters move into one dialog, and the sidebar starts as the icon rail.
